/* Markdown Tools — DOM to OOXML (.docx) exporter.
 *
 * Source module (ESM). Bundled offline with esbuild into
 * assets/vendor/docx/word-docx.bundle.js via scripts/build-docx-bundle.mjs —
 * no CDN, no runtime npm dependency in the browser.
 *
 * Only docx APIs verified against node_modules/docx/dist/index.d.ts are used.
 * Where an enum member name was ambiguous, plain OOXML string literals are
 * passed instead (the library forwards them verbatim).
 */

import {
	AlignmentType,
	BorderStyle,
	Document,
	ExternalHyperlink,
	Footer,
	Header,
	HeadingLevel,
	ImageRun,
	Packer,
	PageNumber,
	Paragraph,
	Table,
	TableCell,
	TableRow,
	TextRun,
	ThematicBreak,
} from "docx";

var DOCX_MIME =
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document";

var FONT_BODY = { ascii: "Vazirmatn", hAnsi: "Vazirmatn", cs: "Vazirmatn" };
var FONT_MONO = { ascii: "Consolas", hAnsi: "Consolas", cs: "Consolas" };

var INK = "18181B";
var MUTED = "475569";
var ACCENT = "1D4ED8";
var LINK = "2563EB";
var CODE_INK = "1E293B";
var CODE_BG = "F1F5F9";
var INLINE_CODE_BG = "F4F4F5";
var QUOTE_BG = "F8FAFC";
var TH_BG = "E2E8F0";
var TABLE_LINE = "94A3B8";
var QUOTE_LINE = "93C5FD";

var MAX_IMAGE_PX = 600;
var IMAGE_TIMEOUT_MS = 10000;
var MERMAID_TIMEOUT_MS = 15000;

function isElement(node, tag) {
	return (
		node &&
		node.nodeType === 1 &&
		(!tag || node.tagName === tag.toUpperCase())
	);
}

function childElements(node, tag) {
	var out = [];
	if (!node || !node.childNodes) return out;
	for (var i = 0; i < node.childNodes.length; i++) {
		var c = node.childNodes[i];
		if (isElement(c) && (!tag || c.tagName === tag.toUpperCase())) out.push(c);
	}
	return out;
}

function directText(node) {
	var parts = [];
	(function walk(n) {
		if (!n) return;
		if (n.nodeType === 3) parts.push(n.nodeValue || "");
		else if (n.nodeType === 1) {
			for (var i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]);
		}
	})(node);
	return parts.join("");
}

function collapseInlineText(text) {
	return String(text == null ? "" : text).replace(/\s+/g, " ");
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

function parseDataUrl(src) {
	var m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(src || "");
	if (!m) return null;
	var mime = (m[1] || "").toLowerCase();
	var isBase64 = !!m[2];
	var payload = m[3] || "";
	if (!isBase64) {
		try {
			payload = decodeURIComponent(payload);
		} catch (e) {
			/* keep raw */
		}
		var bytes = new TextEncoder().encode(payload);
		return { mime: mime, bytes: bytes };
	}
	if (payload.length > 12000000) return null;
	try {
		var bin = atob(payload.replace(/\s+/g, ""));
		var arr = new Uint8Array(bin.length);
		for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
		return { mime: mime, bytes: arr };
	} catch (e) {
		return null;
	}
}

function imageTypeFromMime(mime) {
	if (mime === "image/png") return "png";
	if (mime === "image/jpeg") return "jpg";
	if (mime === "image/gif") return "gif";
	if (mime === "image/bmp") return "bmp";
	return null;
}

function imageTypeFromBytes(bytes) {
	if (!bytes || bytes.length < 4) return null;
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
		return "png";
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
	if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
	if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
	return null;
}

function withTimeout(promise, ms, message) {
	var timer = null;
	var gate = new Promise(function (_, reject) {
		timer = setTimeout(function () {
			reject(new Error(message || "timeout"));
		}, ms);
	});
	return Promise.race([promise, gate]).then(
		function (v) {
			clearTimeout(timer);
			return v;
		},
		function (e) {
			clearTimeout(timer);
			throw e;
		}
	);
}

function loadBitmap(url, timeoutMs) {
	return withTimeout(
		new Promise(function (resolve, reject) {
			var img = new Image();
			img.onload = function () {
				resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
			};
			img.onerror = function () {
				reject(new Error("image decode failed"));
			};
			img.src = url;
		}),
		timeoutMs || IMAGE_TIMEOUT_MS,
		"image load timeout"
	);
}

function looksLikeSvgText(text) {
	return /^\s*<\s*svg[\s>]/i.test(text || "");
}

async function rasterizeSvgText(svgText, timeoutMs) {
	var blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
	var url = URL.createObjectURL(blob);
	try {
		var size = await loadBitmap(url, timeoutMs || MERMAID_TIMEOUT_MS);
		var w = size.width || 800;
		var h = size.height || 400;
		if (!(w > 0) || !(h > 0)) {
			w = 800;
			h = 400;
		}
		var scale = Math.min(2, 1200 / Math.max(1, w));
		var cw = Math.max(1, Math.min(2400, Math.round(w * scale)));
		var ch = Math.max(1, Math.min(2400, Math.round(h * scale)));
		var img = await withTimeout(
			new Promise(function (resolve, reject) {
				var el = new Image();
				el.onload = function () {
					resolve(el);
				};
				el.onerror = function () {
					reject(new Error("svg raster failed"));
				};
				el.src = url;
			}),
			timeoutMs || MERMAID_TIMEOUT_MS,
			"svg raster timeout"
		);
		var canvas = document.createElement("canvas");
		canvas.width = cw;
		canvas.height = ch;
		var ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("no 2d context");
		ctx.fillStyle = "#FFFFFF";
		ctx.fillRect(0, 0, cw, ch);
		ctx.drawImage(img, 0, 0, cw, ch);
		var png = await new Promise(function (resolve) {
			canvas.toBlob(function (b) {
				resolve(b);
			}, "image/png");
		});
		if (!png) throw new Error("canvas toBlob failed");
		var buf = await png.arrayBuffer();
		return { bytes: buf, width: cw, height: ch };
	} finally {
		URL.revokeObjectURL(url);
	}
}

function fitWithin(w, h, maxW) {
	w = Number(w) || 0;
	h = Number(h) || 0;
	if (!(w > 0) || !(h > 0)) return { width: maxW, height: Math.round((maxW * 3) / 4) };
	if (w <= maxW) return { width: Math.round(w), height: Math.round(h) };
	return { width: maxW, height: Math.max(1, Math.round((h * maxW) / w)) };
}

/* Resolve an <img> element to raster bytes + pixel size, or null. */
async function resolveImage(img) {
	var src = img.getAttribute("src") || "";
	if (!src || /^(javascript|vbscript|data:text\/html)/i.test(src)) return null;
	try {
		if (src.indexOf("data:") === 0) {
			var parsed = parseDataUrl(src);
			if (!parsed) return null;
			var kind = imageTypeFromMime(parsed.mime) || imageTypeFromBytes(parsed.bytes);
			if (kind) {
				var dims = { width: 0, height: 0 };
				try {
					dims = await loadBitmap(src, IMAGE_TIMEOUT_MS);
				} catch (e) {
					/* size unknown — fall back below */
				}
				var fit = fitWithin(dims.width, dims.height, MAX_IMAGE_PX);
				return { type: kind, data: parsed.bytes, width: fit.width, height: fit.height };
			}
			if (parsed.mime === "image/svg+xml" || looksLikeSvgText(new TextDecoder().decode(parsed.bytes.slice(0, 512)))) {
				var svgText = new TextDecoder().decode(parsed.bytes);
				var raster = await rasterizeSvgText(svgText, IMAGE_TIMEOUT_MS);
				var fitSvg = fitWithin(raster.width, raster.height, MAX_IMAGE_PX);
				return { type: "png", data: raster.bytes, width: fitSvg.width, height: fitSvg.height };
			}
			return null;
		}
		var absolute = src;
		try {
			absolute = new URL(src, document.baseURI).href;
		} catch (e) {
			/* keep original */
		}
		if (!/^(https?|blob|file):/i.test(absolute)) return null;
		var res = await withTimeout(fetch(absolute), IMAGE_TIMEOUT_MS, "image fetch timeout");
		if (!res || !res.ok) return null;
		var mime = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
		var buf = await res.arrayBuffer();
		var bytes = new Uint8Array(buf);
		var t = imageTypeFromMime(mime) || imageTypeFromBytes(bytes);
		if (t) {
			var d = { width: 0, height: 0 };
			try {
				d = await loadBitmap(absolute, IMAGE_TIMEOUT_MS);
			} catch (e) {
				/* ignore */
			}
			var f = fitWithin(d.width, d.height, MAX_IMAGE_PX);
			return { type: t, data: buf, width: f.width, height: f.height };
		}
		var asText = null;
		try {
			asText = new TextDecoder().decode(bytes.slice(0, 4096));
		} catch (e) {
			asText = null;
		}
		if (asText && looksLikeSvgText(asText)) {
			var full = new TextDecoder().decode(bytes);
			var r = await rasterizeSvgText(full, IMAGE_TIMEOUT_MS);
			var fr = fitWithin(r.width, r.height, MAX_IMAGE_PX);
			return { type: "png", data: r.bytes, width: fr.width, height: fr.height };
		}
		return null;
	} catch (e) {
		return null;
	}
}

/* ------------------------------------------------------------------ */
/* Inline runs                                                         */
/* ------------------------------------------------------------------ */

function baseRun(st, text, extra) {
	var opts = { text: text, font: FONT_BODY, size: 22, color: INK };
	if (extra) {
		for (var k in extra) opts[k] = extra[k];
	}
	return new TextRun(opts);
}

/* Recursively flatten an inline DOM subtree into docx runs. */
async function runsForNodes(nodes, st, inherited) {
	var out = [];
	for (var i = 0; i < nodes.length; i++) {
		var n = nodes[i];
		if (!n) continue;
		if (n.nodeType === 3) {
			var raw = n.nodeValue || "";
			var text = inherited && inherited.preserveSpace ? raw.replace(/\r\n?/g, "\n") : collapseInlineText(raw);
			if (!text) continue;
			var props = {};
			if (inherited) {
				for (var k in inherited) {
					if (k !== "preserveSpace" && k !== "link") props[k] = inherited[k];
				}
			}
			out.push(baseRun(st, text, props));
		} else if (n.nodeType === 1) {
			var tag = n.tagName;
			if (tag === "SCRIPT" || tag === "STYLE" || tag === "BUTTON") continue;
			if (tag === "BR") {
				out.push(new TextRun({ break: 1, font: FONT_BODY, size: 22 }));
				continue;
			}
			if (tag === "IMG") {
				var imgChild = await imageChild(n, st);
				if (imgChild) out.push(imgChild);
				continue;
			}
			if (tag === "INPUT" && (n.getAttribute("type") || "").toLowerCase() === "checkbox") {
				out.push(baseRun(st, n.checked ? "☑ " : "☐ "));
				continue;
			}
			if (tag === "A") {
				var href = n.getAttribute("href") || "";
				if (!href || /^(javascript|vbscript|data):/i.test(href)) {
					var flat = await runsForNodes(n.childNodes, st, inherited);
					for (var f = 0; f < flat.length; f++) out.push(flat[f]);
					continue;
				}
				var linkNext = { color: LINK, underline: {} };
				if (inherited) {
					if (inherited.bold) {
						linkNext.bold = true;
						linkNext.boldComplexScript = true;
					}
					if (inherited.italics) {
						linkNext.italics = true;
						linkNext.italicsComplexScript = true;
					}
				}
				var linkRuns = await runsForNodes(n.childNodes, st, linkNext);
				if (linkRuns.length) {
					out.push(new ExternalHyperlink({ link: href, children: linkRuns }));
				}
				continue;
			}
			var next = {};
			if (inherited) {
				for (var p in inherited) next[p] = inherited[p];
			}
			if (tag === "STRONG" || tag === "B") {
				next.bold = true;
				next.boldComplexScript = true;
			} else if (tag === "EM" || tag === "I") {
				next.italics = true;
				next.italicsComplexScript = true;
			} else if (tag === "U") {
				next.underline = {};
			} else if (tag === "S" || tag === "STRIKE" || tag === "DEL") {
				next.strike = true;
			} else if (tag === "SUP") {
				next.superScript = true;
			} else if (tag === "SUB") {
				next.subScript = true;
			} else if (tag === "MARK") {
				next.highlight = "yellow";
			} else if (tag === "SMALL") {
				next.size = 18;
			} else if (tag === "CODE" || tag === "KBD" || tag === "SAMP" || tag === "TT") {
				next.font = FONT_MONO;
				next.size = 19;
				next.color = "3F3F46";
				next.shading = { fill: INLINE_CODE_BG };
			}
			var inner = await runsForNodes(n.childNodes, st, next);
			for (var q = 0; q < inner.length; q++) out.push(inner[q]);
		}
	}
	return out;
}

/* An <img> inside a paragraph: inline image run, or a textual fallback. */
function imageFallbackNode(st, img, label, extra) {
	/* ponytail: remote images without CORS headers can't be fetched for
	   embedding (pixel bytes are unreadable cross-origin), so link the
	   caption to the live URL instead of leaving a dead "[image: ...]". */
	var src = (img && img.getAttribute && img.getAttribute("src")) || "";
	var linkable = /^https?:/i.test(src);
	var props = linkable
		? { italics: true, color: LINK, underline: {} }
		: { italics: true, color: MUTED };
	if (extra) {
		for (var k in extra) props[k] = extra[k];
	}
	var run = baseRun(st, label, props);
	if (linkable) {
		try {
			return new ExternalHyperlink({ link: src, children: [run] });
		} catch (e) {
			/* fall through to the plain run */
		}
	}
	return run;
}

async function imageChild(img, st) {
	var resolved = await resolveImage(img);
	if (resolved) {
		try {
			return new ImageRun({
				type: resolved.type,
				data: resolved.data,
				transformation: { width: resolved.width, height: resolved.height },
			});
		} catch (e) {
			/* fall through to text fallback */
		}
	}
	var alt = img.getAttribute("alt") || "";
	if (!alt) return null;
	return imageFallbackNode(st, img, "[image: " + alt + "]", null);
}

/* ------------------------------------------------------------------ */
/* Block paragraphs                                                    */
/* ------------------------------------------------------------------ */

function paraOptions(st, opts) {
	var merged = {};
	if (st.rtl) merged.bidirectional = true;
	if (opts) {
		for (var k in opts) merged[k] = opts[k];
	}
	return merged;
}

function bodyPara(st, children, extra) {
	var opts = { children: children, spacing: { after: 160 }, alignment: AlignmentType.BOTH };
	if (extra) {
		for (var k in extra) opts[k] = extra[k];
	}
	if (st.quote) applyQuoteStyle(st, opts);
	return new Paragraph(paraOptions(st, opts));
}

function applyQuoteStyle(st, opts) {
	opts.indent = { start: 720 };
	opts.shading = { fill: QUOTE_BG };
	var side = st.rtl ? "right" : "left";
	opts.border = {};
	opts.border[side] = { style: BorderStyle.SINGLE, color: QUOTE_LINE, size: 18, space: 8 };
}

var HEADING_SIZES = [40, 32, 26, 23, 22, 22];
var HEADING_BEFORE = [360, 300, 260, 220, 200, 180];
var HEADING_AFTER = [160, 140, 120, 100, 80, 80];
var HEADING_LEVELS = [
	HeadingLevel.HEADING_1,
	HeadingLevel.HEADING_2,
	HeadingLevel.HEADING_3,
	HeadingLevel.HEADING_4,
	HeadingLevel.HEADING_5,
	HeadingLevel.HEADING_6,
];

async function headingPara(st, level, node) {
	var runs = await runsForNodes(node.childNodes, st, {
		bold: true,
		boldComplexScript: true,
		size: HEADING_SIZES[level],
		color: "111827",
		font: FONT_BODY,
	});
	if (!runs.length) return null;
	return new Paragraph(
		paraOptions(st, {
			heading: HEADING_LEVELS[level],
			/* ponytail: with w:bidi, jc=start = leading edge of RTL = visual RIGHT
			   (Word 2021). jc=end is the trailing edge = visual LEFT — the bug
			   we hit. Physical right/left are ignored under Heading styles.
			   Cells already used START and rendered correctly in both Word & Docs. */
			alignment: st.rtl ? AlignmentType.START : AlignmentType.LEFT,
			/* ponytail: NO direct keepNext — the built-in Heading styles already
			   carry keep-with-next, so Word is unaffected; but a direct keepNext
			   on every heading makes Google Docs' importer push content across
			   pages, yielding long runs of blank pages. */
			spacing: { before: HEADING_BEFORE[level], after: HEADING_AFTER[level] },
			children: runs,
		})
	);
}

/* ------------------------------------------------------------------ */
/* Lists                                                               */
/* ------------------------------------------------------------------ */

function isList(node) {
	return isElement(node, "UL") || isElement(node, "OL");
}

function listItemBlocks(li) {
	/* Split an <li> into leading-inline / nested-list / trailing-block runs. */
	var segments = [];
	var inlineBuf = [];
	function flushInline() {
		if (inlineBuf.length) {
			segments.push({ kind: "inline", nodes: inlineBuf });
			inlineBuf = [];
		}
	}
	for (var i = 0; i < li.childNodes.length; i++) {
		var c = li.childNodes[i];
		if (isList(c)) {
			flushInline();
			segments.push({ kind: "list", node: c });
		} else if (isElement(c, "P") || isElement(c, "DIV") || isElement(c, "BLOCKQUOTE") || isElement(c, "PRE") || isElement(c, "TABLE") || isElement(c, "HR")) {
			flushInline();
			segments.push({ kind: "block", node: c });
		} else {
			inlineBuf.push(c);
		}
	}
	flushInline();
	return segments;
}

function numberedPara(st, ref, level, children) {
	var opts = {
		children: children,
		numbering: { reference: ref, level: Math.min(8, level) },
		spacing: { after: 80 },
	};
	if (st.quote) applyQuoteStyle(st, opts);
	return new Paragraph(paraOptions(st, opts));
}

async function appendList(listNode, st, out, level) {
	var ordered = listNode.tagName === "OL";
	var ref = ordered ? "rtlmd-number" : "rtlmd-bullet";
	var items = childElements(listNode, "LI");
	for (var i = 0; i < items.length; i++) {
		var segments = listItemBlocks(items[i]);
		for (var s = 0; s < segments.length; s++) {
			var seg = segments[s];
			if (seg.kind === "list") {
				await appendList(seg.node, st, out, level + 1);
			} else if (seg.kind === "block") {
				if (isElement(seg.node, "P")) {
					var runs = await runsForNodes(seg.node.childNodes, st, null);
					if (runs.length) out.push(numberedPara(st, ref, level, runs));
				} else {
					await appendBlock(seg.node, st, out);
				}
			} else {
				var inline = await runsForNodes(seg.nodes, st, null);
				if (inline.length) out.push(numberedPara(st, ref, level, inline));
			}
		}
	}
}

/* ------------------------------------------------------------------ */
/* Code blocks, tables, images, diagrams                               */
/* ------------------------------------------------------------------ */

function codeLines(text) {
	var lines = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
	while (lines.length && lines[lines.length - 1] === "") lines.pop();
	while (lines.length && lines[0] === "") lines.shift();
	return lines;
}

/* Usable text width in twips: A4 page (11906) minus the section side margins
   (2×1134, see the sections config in buildDocxBlob). Passed as explicit
   column widths because the OOXML engine emits 100-twip grid columns when no
   widths are given — Word honors those, rendering single-column (code)
   tables one character wide with vertical text. */
var CONTENT_TWIPS = 11906 - 2 * 1134;

function codeBlockTable(st, codeText) {
	var lines = codeLines(codeText);
	if (!lines.length) return null;
	var paras = lines.map(function (line) {
		/* ponytail: force LTR — Persian Word installs default Normal to RTL, so
		   a bare jc=left still inherits bidi and hugs the right of the cell.
		   bidirectional:false emits <w:bidi w:val="0"/> and pins LTR. */
		return new Paragraph({
			bidirectional: false,
			alignment: AlignmentType.LEFT,
			spacing: { before: 0, after: 0 },
			children: [
				new TextRun({
					text: line === "" ? String.fromCharCode(160) : line,
					font: FONT_MONO,
					size: 18,
					color: CODE_INK,
				}),
			],
		});
	});
	return new Table({
		width: { size: 100, type: "pct" },
		columnWidths: [CONTENT_TWIPS],
		borders: {
			top: { style: BorderStyle.SINGLE, color: "CBD5E1", size: 4 },
			bottom: { style: BorderStyle.SINGLE, color: "CBD5E1", size: 4 },
			left: { style: BorderStyle.SINGLE, color: "CBD5E1", size: 4 },
			right: { style: BorderStyle.SINGLE, color: "CBD5E1", size: 4 },
			insideHorizontal: { style: BorderStyle.NIL, size: 0 },
			insideVertical: { style: BorderStyle.NIL, size: 0 },
		},
		rows: [
			new TableRow({
				children: [
					new TableCell({
						shading: { fill: CODE_BG },
						margins: { top: 80, bottom: 80, left: 140, right: 140 },
						width: { size: CONTENT_TWIPS, type: "dxa" },
						children: paras,
					}),
				],
			}),
		],
	});
}

function cellParagraphs(st, cell, header) {
	var blocks = [];
	var kids = cell.childNodes;
	var hasBlocks = false;
	for (var i = 0; i < kids.length; i++) {
		if (isElement(kids[i])) {
			hasBlocks = true;
			break;
		}
	}
	var inherited = header ? { bold: true, boldComplexScript: true } : null;
	if (!hasBlocks) {
		return runsForNodes(kids, st, inherited).then(function (runs) {
			if (!runs.length) runs = [baseRun(st, "", null)];
			var opts = {
				children: runs,
				alignment: AlignmentType.START,
				spacing: { before: 0, after: 0 },
			};
			return [new Paragraph(paraOptions(st, opts))];
		});
	}
	var out = [];
	var jobs = [];
	for (var j = 0; j < kids.length; j++) {
		(function (child) {
			jobs.push(
				(async function () {
					if (child.nodeType === 3) {
						if (!collapseInlineText(child.nodeValue || "")) return;
						out.push(
							new Paragraph(
								paraOptions(st, {
									children: [baseRun(st, collapseInlineText(child.nodeValue), header ? { bold: true, boldComplexScript: true } : null)],
									alignment: AlignmentType.START,
									spacing: { before: 0, after: 0 },
								})
							)
						);
					} else if (isElement(child, "P")) {
						var runs = await runsForNodes(child.childNodes, st, inherited);
						if (runs.length) {
							out.push(
								new Paragraph(
									paraOptions(st, {
										children: runs,
										alignment: AlignmentType.START,
										spacing: { before: 0, after: 0 },
									})
								)
							);
						}
					} else if (isList(child)) {
						var tmp = [];
						await appendList(child, st, tmp, 0);
						for (var t = 0; t < tmp.length; t++) out.push(tmp[t]);
					} else {
						var flat = await runsForNodes([child], st, inherited);
						if (flat.length) {
							out.push(
								new Paragraph(
									paraOptions(st, {
										children: flat,
										alignment: AlignmentType.START,
										spacing: { before: 0, after: 0 },
									})
								)
							);
						}
					}
				})()
			);
		})(kids[j]);
	}
	return Promise.all(jobs).then(function () {
		if (!out.length) out.push(new Paragraph(paraOptions(st, { children: [baseRun(st, "", null)] })));
		return out;
	});
}

async function tableBlock(st, table) {
	var headerRows = [];
	var bodyRows = [];
	var theads = childElements(table, "THEAD");
	var tbodies = childElements(table, "TBODY");
	if (theads.length) {
		var hrs = childElements(theads[0], "TR");
		for (var h = 0; h < hrs.length; h++) headerRows.push(hrs[h]);
	}
	var bodyTrs = [];
	if (tbodies.length) {
		for (var b = 0; b < tbodies.length; b++) {
			var rs = childElements(tbodies[b], "TR");
			for (var r = 0; r < rs.length; r++) bodyTrs.push(rs[r]);
		}
	} else {
		var all = childElements(table, "TR");
		for (var a = 0; a < all.length; a++) bodyTrs.push(all[a]);
	}
	if (!headerRows.length && bodyTrs.length) {
		var firstCells = childElements(bodyTrs[0], "TH");
		if (firstCells.length) {
			headerRows.push(bodyTrs[0]);
			bodyTrs = bodyTrs.slice(1);
		}
	}
	/* Explicit equal column widths (see CONTENT_TWIPS): the engine's default
	   100-twip grid columns render degenerately narrow in Word. */
	var colCount = 1;
	(headerRows.concat(bodyTrs)).forEach(function (tr) {
		var n = 0;
		for (var i = 0; i < tr.childNodes.length; i++) {
			var c = tr.childNodes[i];
			if (isElement(c, "TH") || isElement(c, "TD")) {
				var sp = parseInt(c.getAttribute("colspan") || "1", 10);
				n += sp > 1 ? sp : 1;
			}
		}
		if (n > colCount) colCount = n;
	});
	var colW = Math.floor(CONTENT_TWIPS / colCount);
	var colWidths = [];
	for (var wi = 0; wi < colCount; wi++) colWidths.push(colW);
	async function rowCells(tr, header) {
		var cells = childElements(tr, "TH").concat(childElements(tr, "TD"));
		/* Preserve document order (TH and TD may interleave). */
		cells = [];
		for (var i = 0; i < tr.childNodes.length; i++) {
			var c = tr.childNodes[i];
			if (isElement(c, "TH") || isElement(c, "TD")) cells.push(c);
		}
		var out = [];
		for (var k = 0; k < cells.length; k++) {
			var cell = cells[k];
			var isHeader = header || cell.tagName === "TH";
			var paras = await cellParagraphs(st, cell, isHeader);
			var cs = parseInt(cell.getAttribute("colspan") || "1", 10);
			var opts = { children: paras, width: { size: colW * (cs > 1 ? cs : 1), type: "dxa" } };
			if (isHeader) opts.shading = { fill: TH_BG };
			if (cs > 1) opts.columnSpan = cs;
			var rs = cell.getAttribute("rowspan");
			if (rs && parseInt(rs, 10) > 1) opts.rowSpan = parseInt(rs, 10);
			out.push(new TableCell(opts));
		}
		return out;
	}
	var rows = [];
	for (var i = 0; i < headerRows.length; i++) {
		rows.push(
		/* ponytail: rows stay breakable across pages (Word's own default). A direct
	   cantSplit on every row forces renderers to push whole rows forward; with
	   a tall table Google Docs' importer cascades that into blank pages. */
		new TableRow({ tableHeader: true, children: await rowCells(headerRows[i], true) })
		);
	}
	for (var j = 0; j < bodyTrs.length; j++) {
		rows.push(new TableRow({ children: await rowCells(bodyTrs[j], false) }));
	}
	if (!rows.length) return null;
	var thin = { style: BorderStyle.SINGLE, color: TABLE_LINE, size: 4 };
	var tbl = { rows: rows, width: { size: 100, type: "pct" }, columnWidths: colWidths, borders: { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin }, margins: { top: 40, bottom: 40, left: 100, right: 100 } };
	if (st.rtl) tbl.visuallyRightToLeft = true;
	return new Table(tbl);
}

async function imageBlock(st, img, captionText) {
	var resolved = await resolveImage(img);
	var out = [];
	if (resolved) {
		try {
			out.push(
				new Paragraph(
					paraOptions(st, {
						alignment: AlignmentType.CENTER,
						spacing: { before: 160, after: 80 },
						children: [
							new ImageRun({
								type: resolved.type,
								data: resolved.data,
								transformation: { width: resolved.width, height: resolved.height },
							}),
						],
					})
				)
			);
		} catch (e) {
			resolved = null;
		}
	}
	var caption = captionText || img.getAttribute("alt") || "";
	if (!resolved && caption) {
		out.push(
			new Paragraph(
				paraOptions(st, {
					alignment: AlignmentType.CENTER,
					children: [imageFallbackNode(st, img, "[image: " + caption + "]", { size: 18 })],
				})
			)
		);
		return out;
	}
	if (resolved && caption) {
		out.push(
			new Paragraph(
				paraOptions(st, {
					alignment: AlignmentType.CENTER,
					spacing: { before: 0, after: 160 },
					children: [baseRun(st, caption, { italics: true, color: MUTED, size: 18 })],
				})
			)
		);
	}
	return out;
}

async function mermaidBlocks(st, wrap) {
	var svg = wrap.querySelector("svg");
	var fallback = wrap.querySelector("pre");
	if (svg) {
		try {
			var xml = new XMLSerializer().serializeToString(svg);
			var raster = await rasterizeSvgText(xml, MERMAID_TIMEOUT_MS);
			var fit = fitWithin(raster.width, raster.height, MAX_IMAGE_PX);
			return [
				new Paragraph(
					paraOptions(st, {
						alignment: AlignmentType.CENTER,
						spacing: { before: 160, after: 160 },
						children: [
							new ImageRun({
								type: "png",
								data: raster.bytes,
								transformation: { width: fit.width, height: fit.height },
							}),
						],
					})
				),
			];
		} catch (e) {
			/* fall through to source-text fallback */
		}
	}
	var src = fallback ? directText(fallback) : "";
	if (!src) return [];
	var tbl = codeBlockTable(st, src);
	return tbl ? [tbl] : [];
}

/* ------------------------------------------------------------------ */
/* Block dispatcher                                                    */
/* ------------------------------------------------------------------ */

var BLOCK_TAGS = {
	ADDRESS: 1, ARTICLE: 1, ASIDE: 1, BLOCKQUOTE: 1, DETAILS: 1, DIALOG: 1,
	DIV: 1, DL: 1, FIELDSET: 1, FIGCAPTION: 1, FIGURE: 1, FOOTER: 1,
	H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, HEADER: 1, HGROUP: 1,
	HR: 1, LI: 1, MAIN: 1, NAV: 1, OL: 1, P: 1, PRE: 1, SECTION: 1,
	TABLE: 1, UL: 1,
};

function isOnlyImagePara(p) {
	var seen = false;
	for (var i = 0; i < p.childNodes.length; i++) {
		var c = p.childNodes[i];
		if (c.nodeType === 3) {
			if (collapseInlineText(c.nodeValue || "")) return false;
		} else if (isElement(c, "IMG")) {
			if (seen) return false;
			seen = true;
		} else if (isElement(c, "A") && c.querySelector("img") && collapseInlineText(directText(c).replace(/\s+/g, "")) === "") {
			if (seen) return false;
			seen = true;
		} else {
			return false;
		}
	}
	return seen;
}

function firstImage(p) {
	var img = p.querySelector("img");
	return img;
}

async function appendBlock(node, st, out) {
	if (!node) return;
	if (node.nodeType === 3) {
		if (!collapseInlineText(node.nodeValue || "")) return;
		out.push(bodyPara(st, [baseRun(st, collapseInlineText(node.nodeValue))]));
		return;
	}
	if (node.nodeType !== 1) return;
	var tag = node.tagName;
	if (tag === "SCRIPT" || tag === "STYLE" || tag === "BUTTON") return;
	if (node.classList && node.classList.contains("code-copy")) return;
	if (node.classList && node.classList.contains("code-lang")) return;
	if (node.classList && node.classList.contains("mermaid-toolbar")) return;

	if (/^H[1-6]$/.test(tag)) {
		var hp = await headingPara(st, parseInt(tag.charAt(1), 10) - 1, node);
		if (hp) out.push(hp);
		return;
	}
	if (tag === "P") {
		if (isOnlyImagePara(node)) {
			var blocks = await imageBlock(st, firstImage(node), null);
			for (var b = 0; b < blocks.length; b++) out.push(blocks[b]);
			return;
		}
		var kids = [];
		var fragmented = false;
		for (var i = 0; i < node.childNodes.length; i++) {
			var c = node.childNodes[i];
			if (isElement(c) && (BLOCK_TAGS[c.tagName] || c.tagName === "IMG")) {
				fragmented = true;
				break;
			}
			kids.push(c);
		}
		if (fragmented) {
			for (var j = 0; j < node.childNodes.length; j++) {
				var d = node.childNodes[j];
				if (d.nodeType === 3) {
					if (!collapseInlineText(d.nodeValue || "")) continue;
					out.push(bodyPara(st, [baseRun(st, collapseInlineText(d.nodeValue))]));
				} else if (isElement(d, "IMG")) {
					var ib = await imageBlock(st, d, null);
					for (var q = 0; q < ib.length; q++) out.push(ib[q]);
				} else if (isElement(d)) {
					await appendBlock(d, st, out);
				}
			}
			return;
		}
		var runs = await runsForNodes(node.childNodes, st, null);
		if (runs.length) out.push(bodyPara(st, runs));
		return;
	}
	if (tag === "UL" || tag === "OL") {
		await appendList(node, st, out, 0);
		return;
	}
	if (tag === "BLOCKQUOTE") {
		var inner = [];
		await appendChildren(node, { rtl: st.rtl, quote: true }, inner);
		for (var bq = 0; bq < inner.length; bq++) out.push(inner[bq]);
		return;
	}
	if (tag === "PRE") {
		var code = node.querySelector("code");
		var tbl = codeBlockTable(st, directText(code || node));
		if (tbl) {
			out.push(new Paragraph(paraOptions(st, { children: [], spacing: { before: 120, after: 0 } })));
			out.push(tbl);
		}
		return;
	}
	if (tag === "TABLE") {
		var t = await tableBlock(st, node);
		if (t) out.push(t);
		return;
	}
	if (tag === "HR") {
		out.push(new ThematicBreak());
		return;
	}
	if (tag === "IMG") {
		var single = await imageBlock(st, node, null);
		for (var s = 0; s < single.length; s++) out.push(single[s]);
		return;
	}
	if (tag === "FIGURE") {
		var figImg = node.querySelector("img");
		var cap = node.querySelector("figcaption");
		var capText = cap ? collapseInlineText(directText(cap)) : "";
		if (figImg) {
			var fb = await imageBlock(st, figImg, capText || null);
			for (var f2 = 0; f2 < fb.length; f2++) out.push(fb[f2]);
		} else if (capText) {
			out.push(bodyPara(st, [baseRun(st, capText, { italics: true, color: MUTED })]));
		}
		return;
	}
	if (tag === "FIGCAPTION") {
		return;
	}
	if (node.classList && node.classList.contains("mermaid-wrap")) {
		var mb = await mermaidBlocks(st, node);
		for (var m = 0; m < mb.length; m++) out.push(mb[m]);
		return;
	}
	if (node.classList && node.classList.contains("table-scroll")) {
		var innerTable = node.querySelector("table");
		if (innerTable) {
			var it = await tableBlock(st, innerTable);
			if (it) out.push(it);
		}
		return;
	}
	if (node.classList && (node.classList.contains("katex-display") || node.classList.contains("katex"))) {
		var mathRuns = await runsForNodes(node.childNodes, st, { italics: true });
		if (!mathRuns.length) {
			var txt = collapseInlineText(directText(node));
			if (txt) mathRuns = [baseRun(st, txt, { italics: true })];
		}
		if (mathRuns.length) {
			out.push(
				new Paragraph(
					paraOptions(st, {
						alignment: AlignmentType.CENTER,
						spacing: { before: 120, after: 120 },
						children: mathRuns,
					})
				)
			);
		}
		return;
	}
	if (tag === "DIV" || tag === "SECTION" || tag === "ARTICLE" || tag === "MAIN" || tag === "DETAILS" || tag === "SUMMARY" || tag === "NAV" || tag === "HEADER" || tag === "FOOTER" || tag === "FIGURE" || tag === "ASIDE") {
		if (tag === "SUMMARY") {
			var sRuns = await runsForNodes(node.childNodes, st, { bold: true, boldComplexScript: true });
			if (sRuns.length) out.push(bodyPara(st, sRuns));
			return;
		}
		await appendChildren(node, st, out);
		return;
	}
	if (tag === "BR") {
		out.push(bodyPara(st, [baseRun(st, "", null)]));
		return;
	}
	/* Inline leftovers at block level (B, SPAN, A, CODE, INPUT, ...). */
	var leftover = await runsForNodes([node], st, null);
	if (leftover.length) out.push(bodyPara(st, leftover));
}

async function appendChildren(node, st, out) {
	var kids = node.childNodes ? Array.prototype.slice.call(node.childNodes) : [];
	for (var i = 0; i < kids.length; i++) {
		var c = kids[i];
		if (c.nodeType === 3 && !collapseInlineText(c.nodeValue || "")) continue;
		await appendBlock(c, st, out);
	}
}

/* ------------------------------------------------------------------ */
/* Document assembly                                                   */
/* ------------------------------------------------------------------ */

function bulletLevels() {
	var glyphs = ["●", "○", "■"];
	var levels = [];
	for (var i = 0; i < 9; i++) {
		levels.push({
			level: i,
			format: "bullet",
			text: glyphs[i % 3],
			alignment: AlignmentType.START,
			style: { paragraph: { indent: { start: 720 + i * 360, hanging: 360 } } },
		});
	}
	return levels;
}

function numberLevels() {
	var levels = [];
	for (var i = 0; i < 9; i++) {
		levels.push({
			level: i,
			format: "decimal",
			text: "%" + (i + 1) + ".",
			alignment: AlignmentType.START,
			style: { paragraph: { indent: { start: 720 + i * 360, hanging: 360 } } },
		});
	}
	return levels;
}

function cleanPreviewHtml(html) {
	var doc = new DOMParser().parseFromString(
		"<div data-rtlmd-docx-root>" + String(html == null ? "" : html) + "</div>",
		"text/html"
	);
	var root = doc.querySelector("[data-rtlmd-docx-root]") || doc.body;
	var kill = root.querySelectorAll(
		"script,style,button,.code-copy,.code-lang,.mermaid-toolbar,.preview-toc,.toc-toggle-btn"
	);
	for (var i = 0; i < kill.length; i++) {
		if (kill[i].parentNode) kill[i].parentNode.removeChild(kill[i]);
	}
	var attrs = root.querySelectorAll("[contenteditable],[draggable],[spellcheck],[tabindex]");
	for (var j = 0; j < attrs.length; j++) {
		attrs[j].removeAttribute("contenteditable");
		attrs[j].removeAttribute("draggable");
		attrs[j].removeAttribute("spellcheck");
		attrs[j].removeAttribute("tabindex");
	}
	return root;
}

async function buildDocxBlob(input) {
	var title = (input && input.title) || "Markdown Tools";
	var rtl = !!(input && (input.dir === "rtl" || input.rtl));
	var st = { rtl: rtl, quote: false };
	var root = cleanPreviewHtml(input && input.html);

	var children = [];
	children.push(
		new Paragraph({
			heading: HeadingLevel.TITLE,
			alignment: rtl ? AlignmentType.START : AlignmentType.LEFT,
			bidirectional: rtl || undefined,
			spacing: { before: 0, after: 120 },
			children: [
				new TextRun({
					text: String(title),
					font: FONT_BODY,
					size: 32,
					bold: true,
					boldComplexScript: true,
					color: ACCENT,
				}),
			],
		})
	);
	children.push(new ThematicBreak());

	var body = [];
	await appendChildren(root, st, body);
	if (!body.length) {
		body.push(new Paragraph({ children: [baseRun(st, "", null)] }));
	}
	for (var i = 0; i < body.length; i++) children.push(body[i]);

	var doc = new Document({
		creator: "Markdown Tools",
		title: String(title),
		description: "Exported from Markdown Tools",
		styles: {
			default: {
				document: { run: { font: FONT_BODY, size: 22, color: INK } },
			},
		},
		numbering: {
			config: [
				{ reference: "rtlmd-bullet", levels: bulletLevels() },
				{ reference: "rtlmd-number", levels: numberLevels() },
			],
		},
		sections: [
			{
				properties: {
					page: {
						size: { width: 11906, height: 16838 },
						margin: {
							top: 1134,
							right: 1134,
							bottom: 1134,
							left: 1134,
							header: 708,
							footer: 708,
						},
					},
				},
				headers: {
					default: new Header({
						children: [
							new Paragraph({
								alignment: rtl ? AlignmentType.START : AlignmentType.LEFT,
								bidirectional: rtl || undefined,
								children: [
									new TextRun({
										text: String(title),
										font: FONT_BODY,
										size: 18,
										color: MUTED,
									}),
								],
							}),
						],
					}),
				},
				footers: {
					default: new Footer({
						children: [
							new Paragraph({
								alignment: AlignmentType.CENTER,
								children: [
									new TextRun({
										children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES],
										font: FONT_BODY,
										size: 18,
										color: MUTED,
									}),
								],
							}),
						],
					}),
				},
				children: children,
			},
		],
	});

	var blob = await Packer.toBlob(doc);
	return new Blob([blob], { type: DOCX_MIME });
}

window.RtlmWordDocx = {
	buildDocxBlob: buildDocxBlob,
	version: 1,
};
