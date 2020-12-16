enum TextFormat {
	HTML,
	Markdown,
	Plain,
}

/**
 * Parse the URLs contained in a string into a specific format and return the modified string
 */
export function parseUrls(text: string, format: TextFormat): string {
	const urls = /https?:\/\/\S+?\.\S+/g;

	switch (format) {
		case TextFormat.HTML:     return text.replace(urls, '<a href="$&">$&</a>');
		case TextFormat.Markdown: return text.replace(urls, '[$&]($&)');
		default:                  return text;
	}
}

/**
 * Copy a string into the system clipboard
 */
export function copyToClipboard(text: string): void {
	// Create an invisible textarea containing the string to copy
	const ta = createNewElement('textarea', {
		style:    { position: 'absolute', left: '-9999px' },
		readonly: true,
	}, text);

	// Add it to the DOM
	document.body.appendChild(ta);

	// Select its contents and copy them into the clipboard
	ta.select();
	document.execCommand('copy');

	// Remove the textarea
	document.body.removeChild(ta);
}

/**
 * Create a new menu entry (two <div>, one wrapping the other)
 */
export function createNewMenuEntry(wrapperAttrs: Record<string, any>, innerAttrs: Record<string, any>, text: string): HTMLElement {
	const wrapper = createNewElement('div', wrapperAttrs);
	const inner   = createNewElement('div', innerAttrs, text);

	wrapper.appendChild(inner);

	return wrapper;
}

/**
 * Create a new DOM element
 */
function createNewElement(type: string, attrs: Record<string, any>, textContent: string | undefined = undefined): HTMLElement {
	const el = document.createElement(type);

	// Set the attributes
	Object.keys(attrs).forEach(attr => {
		let val = attrs[attr];

		// If the attribute value is a boolean set to `true`, set it to an empty string
		if (val === true) {
			val = '';
		// If the attribute value is an object (used to set the `style` attribute)
		} else if (val === Object(val) && Object.prototype.toString.call(val) != '[object Array]') {
			// Join the key-value pairs in a single string
			val = Object.keys(val)
				.reduce((acc, key) => { acc.push(`${key}: ${val[key]};`); return acc; }, [])
				.join(' ');
		}

		el.setAttribute(attr, val);
	});

	// Set the text content
	if (textContent) {
		el.textContent = textContent;
	}

	return el;
}

/**
 * Return the current colorscheme of the web app (`dark` or `light`)
 */
export function getColorscheme(): string {
	return document.getElementById('gb').style.cssText == 'background-color: rgb(255, 255, 255);' ? 'light' : 'dark';
}
