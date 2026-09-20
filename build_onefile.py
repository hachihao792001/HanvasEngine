#!/usr/bin/env python3
"""
Bundle index.html and everything it depends on into a single self-contained OneFile.html
(same shape as htmlPreview35.html: one flat <script> block, no modules, no extra files).

What gets inlined:
  * <script src="..."> - the whole ES module graph, flattened in dependency order,
    with `import`/`export` statements stripped so it runs as a classic script, and the
    JSDoc type annotations dropped (they only exist for the type checker; --keep-jsdoc keeps them).
  * <link rel="stylesheet" href="..."> - local CSS, turned into <style>.
  * with --embed-remote: remote assets referenced by URL inside the JS
    (textures, .obj models) are downloaded and turned into data: URIs.

Usage:
    py build_onefile.py                      # index.html -> OneFile.html
    py build_onefile.py --embed-remote       # also bake in textures/models
    py build_onefile.py --keep-jsdoc         # leave the JSDoc comments in
    py build_onefile.py page.html out.html
"""

import argparse
import base64
import mimetypes
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# `import x from "./y.js"` / `import {a, b} from "./y.js"` / `import "./y.js"`
# The clause class excludes quotes and semicolons so it can span newlines safely.
IMPORT_RE = re.compile(
    r"""^[ \t]*import\s+(?:(?:[^'";]+?)\s+from\s+)?['"](?P<spec>[^'"]+)['"][ \t]*;?[ \t]*\r?\n?""",
    re.MULTILINE,
)
# `export { a, b };` and `export { a } from "./y.js";` - drop the whole statement.
EXPORT_LIST_RE = re.compile(
    r"""^[ \t]*export\s*\{[^}]*\}[ \t]*(?:from\s*['"][^'"]+['"])?[ \t]*;?[ \t]*\r?\n?""",
    re.MULTILINE,
)
# `export class X` / `export function f` / `export const c` -> drop just the keyword.
EXPORT_DECL_RE = re.compile(
    r"""^([ \t]*)export\s+(?:default\s+)?(?=(?:async\s+)?(?:class|function|const|let|var)\b)""",
    re.MULTILINE,
)
TOP_LEVEL_DECL_RE = re.compile(
    r"""^(?:async\s+)?(?:class|function|const|let|var)\s+([A-Za-z_$][\w$]*)""",
    re.MULTILINE,
)
SCRIPT_TAG_RE = re.compile(
    r"""(?P<indent>[ \t]*)<script\b(?P<attrs>[^>]*?)\bsrc\s*=\s*["'](?P<src>[^"']+)["'][^>]*>\s*</script>""",
    re.IGNORECASE,
)
LINK_TAG_RE = re.compile(
    r"""(?P<indent>[ \t]*)<link\b(?P<attrs>[^>]*)>""",
    re.IGNORECASE,
)
HREF_RE = re.compile(r"""\bhref\s*=\s*["']([^"']+)["']""", re.IGNORECASE)
# Remote asset URLs sitting in JS string literals.
REMOTE_ASSET_RE = re.compile(
    r"""(?P<quote>["'])(?P<url>https?://[^"']+?\.(?:png|jpe?g|gif|webp|bmp|obj|mtl))(?P=quote)""",
    re.IGNORECASE,
)


def is_remote(url):
    return url.startswith(("http://", "https://", "//", "data:"))


def read_text(path):
    return path.read_text(encoding="utf-8")


JSDOC_MARK = "\x00"
# A line that held nothing but JSDoc, and the leftover marks of the inline `/** @type {X} */ (v)` casts.
JSDOC_LINE_RE = re.compile(r"""^[ \t]*%s[ \t]*\r?\n""" % JSDOC_MARK, re.MULTILINE)
# A `/` starts a regex literal (not a comment) when the previous token cannot end an expression.
REGEX_PRECEDER_RE = re.compile(r"""[(,=:\[!&|?{};+\-*%^~<>]$|\b(?:return|typeof|case|in|of|new|delete|void|do|else)$""")


def mark_jsdoc(source):
    """Replace every /** ... */ block with a marker, leaving strings, regexes and plain comments alone."""
    out = []
    tail = ""  # the last few characters emitted, enough to tell a regex from a division

    def emit(text):
        nonlocal tail
        out.append(text)
        tail = (tail + text)[-16:]

    i, n = 0, len(source)
    while i < n:
        ch = source[i]

        if ch in "'\"":
            quote = ch
            j = i + 1
            while j < n:
                if source[j] == "\\":
                    j += 2
                    continue
                if source[j] == quote:
                    j += 1
                    break
                j += 1
            emit(source[i:j])
            i = j
            continue

        if ch == "`":
            # template literals nest `${ ... }`, which can hold more strings and templates
            depth = 0
            j = i + 1
            while j < n:
                if source[j] == "\\":
                    j += 2
                    continue
                if source[j] == "$" and source.startswith("${", j):
                    depth += 1
                    j += 2
                    continue
                if depth > 0 and source[j] == "}":
                    depth -= 1
                elif depth == 0 and source[j] == "`":
                    j += 1
                    break
                j += 1
            emit(source[i:j])
            i = j
            continue

        if ch == "/" and source.startswith("//", i):
            j = source.find("\n", i)
            j = n if j == -1 else j
            emit(source[i:j])
            i = j
            continue

        if ch == "/" and source.startswith("/*", i):
            end = source.find("*/", i + 2)
            end = n if end == -1 else end + 2
            comment = source[i:end]
            emit(JSDOC_MARK if comment.startswith("/**") else comment)
            i = end
            continue

        if ch == "/":
            # a regex literal - skip it whole, its body may contain anything
            prefix = tail.rstrip()
            if not prefix or REGEX_PRECEDER_RE.search(prefix):
                j = i + 1
                in_class = False
                while j < n and source[j] != "\n":
                    if source[j] == "\\":
                        j += 2
                        continue
                    if source[j] == "[":
                        in_class = True
                    elif source[j] == "]":
                        in_class = False
                    elif source[j] == "/" and not in_class:
                        j += 1
                        break
                    j += 1
                emit(source[i:j])
                i = j
                continue

        emit(ch)
        i += 1

    return "".join(out)


def strip_jsdoc(source):
    """Drop the JSDoc the bundle has no use for: @param/@type/@returns blocks and inline casts."""
    body = mark_jsdoc(source)
    body = JSDOC_LINE_RE.sub("", body)
    body = body.replace(JSDOC_MARK + " ", "").replace(JSDOC_MARK, "")
    return body


def strip_module_syntax(source, module_name, keep_jsdoc=False):
    """Remove import/export syntax; return the plain-script body and the import specifiers."""
    specs = []

    def take_import(match):
        specs.append(match.group("spec"))
        return ""

    body = source if keep_jsdoc else strip_jsdoc(source)
    body = IMPORT_RE.sub(take_import, body)
    body = EXPORT_LIST_RE.sub("", body)
    body = EXPORT_DECL_RE.sub(r"\1", body)

    leftover = re.search(r"^[ \t]*export\b", body, re.MULTILINE)
    if leftover:
        line = body.count("\n", 0, leftover.start()) + 1
        print("  ! %s:%d: unsupported `export` form left as-is" % (module_name, line), file=sys.stderr)

    return body.strip("\n"), specs


def collect_modules(entry, keep_jsdoc=False):
    """Depth-first walk of the module graph -> [(path, body)] with dependencies first."""
    ordered = []
    done = set()
    in_progress = set()

    def visit(path):
        path = path.resolve()
        if path in done:
            return
        if path in in_progress:
            print("  ! import cycle at %s; keeping first-seen order" % path.name, file=sys.stderr)
            return
        if not path.exists():
            raise FileNotFoundError("imported file not found: %s" % path)

        in_progress.add(path)
        body, specs = strip_module_syntax(read_text(path), path.name, keep_jsdoc)
        for spec in specs:
            if is_remote(spec):
                print("  ! %s imports remote module %s; left out" % (path.name, spec), file=sys.stderr)
                continue
            visit((path.parent / spec).resolve())
        in_progress.discard(path)

        done.add(path)
        ordered.append((path, body))

    visit(entry)
    return ordered


def warn_on_collisions(modules):
    """Flattening module scopes into one script scope makes duplicate top-level names fatal."""
    seen = {}
    for path, body in modules:
        for name in TOP_LEVEL_DECL_RE.findall(body):
            if name in seen and seen[name] != path.name:
                print(
                    "  ! `%s` is declared at top level in both %s and %s; "
                    "rename one or the bundle will throw" % (name, seen[name], path.name),
                    file=sys.stderr,
                )
            seen.setdefault(name, path.name)


def detect_indent_unit(html):
    """One indent level, as used by the host document."""
    tabs = len(re.findall(r"^\t+\S", html, re.MULTILINE))
    spaces = len(re.findall(r"^ +\S", html, re.MULTILINE))
    return "\t" if tabs >= spaces else "    "


def normalize_indent(indent, unit):
    """Re-express a captured indent string in terms of `unit` (the document keeps one style)."""
    if "\t" in indent:
        level = indent.count("\t")
    else:
        level = len(indent) // (4 if unit == "\t" else len(unit))
    return unit * level


def advance_js_state(line, state):
    """Track template-literal / block-comment nesting across one line of JS."""
    stack = state["stack"]
    i, n = 0, len(line)
    while i < n:
        ch = line[i]

        if state["block_comment"]:
            if ch == "*" and line.startswith("*/", i):
                state["block_comment"] = False
                i += 2
                continue
            i += 1
            continue

        if stack and stack[-1] == "template":
            if ch == "\\":
                i += 2
                continue
            if ch == "`":
                stack.pop()
            elif ch == "$" and line.startswith("${", i):
                stack.append("expr")
                i += 2
                continue
            i += 1
            continue

        # Plain code, or the inside of a `${ ... }` interpolation.
        if ch == "/" and line.startswith("//", i):
            return
        if ch == "/" and line.startswith("/*", i):
            state["block_comment"] = True
            i += 2
            continue
        if ch in "'\"":
            quote = ch
            i += 1
            while i < n:
                if line[i] == "\\":
                    i += 2
                    continue
                if line[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        if ch == "`":
            stack.append("template")
        elif ch == "{" and stack and stack[-1] in ("expr", "brace"):
            stack.append("brace")
        elif ch == "}" and stack and stack[-1] in ("expr", "brace"):
            stack.pop()
        i += 1


def indent_code(code, prefix):
    """Prefix every line with `prefix`, leaving blank lines and template-literal text alone."""
    state = {"stack": [], "block_comment": False}
    out = []
    for line in code.split("\n"):
        inside_template = bool(state["stack"]) and state["stack"][-1] == "template"
        if inside_template:
            out.append(line)  # raw string content - indenting it would change the value
        elif line.strip():
            out.append(prefix + line)
        else:
            out.append("")
        advance_js_state(line, state)
    return "\n".join(out)


def to_data_uri(raw, url):
    mime = mimetypes.guess_type(urllib.parse.urlparse(url).path)[0]
    if mime is None:
        mime = "text/plain" if url.lower().endswith((".obj", ".mtl")) else "application/octet-stream"
    return "data:%s;base64,%s" % (mime, base64.b64encode(raw).decode("ascii"))


def embed_remote_assets(code):
    """Download every remote texture/model URL in the code and swap in a data: URI."""
    cache = {}

    def replace(match):
        url = match.group("url")
        if url not in cache:
            print("  downloading %s" % url)
            request = urllib.request.Request(url, headers={"User-Agent": "build_onefile.py"})
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    raw = response.read()
            except Exception as error:  # keep the URL, keep building
                print("  ! download failed (%s); leaving the URL in place" % error, file=sys.stderr)
                cache[url] = url
            else:
                print("    %.0f KB inlined" % (len(raw) / 1024))
                cache[url] = to_data_uri(raw, url)
        quote = match.group("quote")
        return "%s%s%s" % (quote, cache[url], quote)

    return REMOTE_ASSET_RE.sub(replace, code)


def bundle(entry_html, output, embed_remote, indent_unit=None, keep_jsdoc=False):
    base = entry_html.parent
    html = read_text(entry_html)
    unit = indent_unit or detect_indent_unit(html)

    def inline_script(match):
        src = match.group("src")
        if is_remote(src):
            return match.group(0)

        entry_js = (base / src).resolve()
        print("  bundling %s" % src)
        modules = collect_modules(entry_js, keep_jsdoc)
        warn_on_collisions(modules)

        chunks = []
        for path, body in modules:
            print("    + %s" % path.name)
            chunks.append("// ===== %s =====\n%s" % (path.name, body))
        code = "\n\n".join(chunks)

        if embed_remote:
            code = embed_remote_assets(code)

        # A literal </script> inside the code would close the tag early.
        code = code.replace("</script>", "<\\/script>")

        tag_indent = normalize_indent(match.group("indent"), unit)
        code = indent_code(code, tag_indent + unit)
        return "%s<script>\n%s\n%s</script>" % (tag_indent, code, tag_indent)

    def inline_link(match):
        attrs = match.group("attrs")
        if "stylesheet" not in attrs.lower():
            return match.group(0)
        href_match = HREF_RE.search(attrs)
        if not href_match or is_remote(href_match.group(1)):
            return match.group(0)

        css_path = (base / href_match.group(1)).resolve()
        if not css_path.exists():
            print("  ! stylesheet not found: %s" % css_path, file=sys.stderr)
            return match.group(0)

        print("  inlining %s" % href_match.group(1))
        tag_indent = normalize_indent(match.group("indent"), unit)
        css = indent_code(read_text(css_path).strip(), tag_indent + unit)
        return "%s<style>\n%s\n%s</style>" % (tag_indent, css, tag_indent)

    html = LINK_TAG_RE.sub(inline_link, html)
    html = SCRIPT_TAG_RE.sub(inline_script, html)

    output.write_text(html, encoding="utf-8")
    print("\nWrote %s (%.0f KB)" % (output, output.stat().st_size / 1024))


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("entry", nargs="?", default="index.html", help="HTML file to bundle (default: index.html)")
    parser.add_argument("output", nargs="?", default="OneFile.html", help="output file (default: OneFile.html)")
    parser.add_argument(
        "--embed-remote",
        action="store_true",
        help="download remote textures/models and bake them in as data: URIs",
    )
    parser.add_argument(
        "--keep-jsdoc",
        action="store_true",
        help="keep the /** @param @type @returns */ blocks instead of stripping them out",
    )
    parser.add_argument(
        "--indent",
        default="auto",
        metavar="auto|tab|N",
        help="indent unit for the inlined code: auto (match the HTML), tab, or N spaces",
    )
    args = parser.parse_args()

    if args.indent == "auto":
        indent_unit = None
    elif args.indent == "tab":
        indent_unit = "\t"
    elif args.indent.isdigit() and int(args.indent) > 0:
        indent_unit = " " * int(args.indent)
    else:
        print("--indent must be auto, tab, or a positive number of spaces", file=sys.stderr)
        return 1

    entry_html = Path(args.entry).resolve()
    if not entry_html.exists():
        print("entry file not found: %s" % entry_html, file=sys.stderr)
        return 1

    output = Path(args.output).resolve()
    if output == entry_html:
        print("output would overwrite the entry file", file=sys.stderr)
        return 1

    print("Bundling %s -> %s" % (entry_html.name, output.name))
    bundle(entry_html, output, args.embed_remote, indent_unit, args.keep_jsdoc)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
