/**
 * SPECS.md says to determine the media type only when possible. An unknown extension
 * returns `undefined` rather than a guess such as `application/octet-stream`.
 */
const MIME_BY_EXTENSION: ReadonlyMap<string, string> = new Map([
	['css', 'text/css'],
	['csv', 'text/csv'],
	['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
	['epub', 'application/epub+zip'],
	['gif', 'image/gif'],
	['htm', 'text/html'],
	['html', 'text/html'],
	['ipynb', 'application/x-ipynb+json'],
	['jpeg', 'image/jpeg'],
	['jpg', 'image/jpeg'],
	['js', 'text/javascript'],
	['json', 'application/json'],
	['md', 'text/markdown'],
	['pdf', 'application/pdf'],
	['png', 'image/png'],
	['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
	['qmd', 'text/markdown'],
	['svg', 'image/svg+xml'],
	['tex', 'application/x-tex'],
	['txt', 'text/plain'],
	['woff', 'font/woff'],
	['woff2', 'font/woff2'],
	['xml', 'application/xml'],
	['yml', 'application/yaml'],
	['yaml', 'application/yaml'],
]);

export const mimeTypeForPath = (filePath: string): string | undefined => {
	const name = filePath.slice(filePath.lastIndexOf('/') + 1);
	const dot = name.lastIndexOf('.');
	// A name with no dot, or a dotfile such as `.gitignore`, has no extension to read.
	if (dot <= 0) {
		return undefined;
	}
	return MIME_BY_EXTENSION.get(name.slice(dot + 1).toLowerCase());
};
