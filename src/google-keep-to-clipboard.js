
/**
 * google-keep-to-clipboard
 *
 * A  browser extension  to copy  the  contents of  Google Keep  notes into  the
 * clipoard in various formats.
 *
 * Copyright (c) 2019-present, cheap glitch
 *
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either  version 3 of the  License, or (at your  option) any later
 * version.
 *
 * This program is distributed  in the hope that it will  be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR  A PARTICULAR  PURPOSE.  See  the GNU  General  Public  License for  more
 * details.
 *
 * You should have received a copy of  the GNU General Public License along with
 * this program. If not, see <https://www.gnu.org/licenses/>.
 */

"use strict";

(function()
{
	let targetNote = null;
	let entryAdded = false;

	// Get all the context menu handles (the three little dots in the toolbar of each note)
	const menuHandles = [...document.querySelectorAll('div[role="toolbar"] div[aria-label="More"]')].slice(2);

	// Add a click event handler on each menu handle to know which note is being targeted
	menuHandles.forEach(_handle => _handle.addEventListener('click', () => targetNote = _handle.parentElement.parentElement.parentElement));

	// Wait for the contextual menu to be created in the <body> element to insert the new entries in it
	(new MutationObserver(function()
	{
		// Prevent the entries from being added twice
		const lastEntry = document.getElementById(':9');
		if (entryAdded || !lastEntry) return;
		entryAdded = true;

		/**
		 * Create and insert the new menu entries
		 * -------------------------------------------------------------
		 */
		const formats = {
			csv:    'CSV',
			html:   'HTML',
			zim:    'Zim markup',
			md:     'Markdown',
			plain:  'Plain text',
		};

		// Insert an entry for every format option
		Object.keys(formats).forEach(_key => lastEntry.insertAdjacentElement('afterend', createNewMenuEntry(
			{
				'role':        'menuitem',
				'class':       `google-keep-to-clipboard-submenu-entry ${lastEntry.className}`,
				'style':       { 'user-select': 'none' },
				'data-format': _key,
			},
			{
				'class':       lastEntry.children.item(0).className,
				'style':       { 'padding-left': '20px' }
			},
			formats[_key]
		)));

		// Insert the "header"
		lastEntry.insertAdjacentElement('afterend', createNewMenuEntry(
			{
				'role':  'menuitem',
				'class': lastEntry.className,
				'style': {
					'padding':      0,
					'border':       'none',
					'cursor':       'default',
					'user-select':  'none',
				}
			},
			{
				'class': lastEntry.children.item(0).className,
				'style': {
					'padding': '5px 10px 5px 17px'
				}
			},
			'Copy to clipboard as…'
		));

		/**
		 * Add some event listeners on the new entries
		 * -------------------------------------------------------------
		 */
		[...document.getElementsByClassName('google-keep-to-clipboard-submenu-entry')].forEach(function(_entry)
		{
			/**
			 * Change background color on hover
			 */
			_entry.addEventListener('mouseleave', () => _entry.style.backgroundColor = 'transparent');
			_entry.addEventListener('mouseenter', function()
			{
				_entry.style.backgroundColor = (getColorscheme() === 'light') ? '#ebebeb' : '#444547';
			});

			/**
			 * Copy the note contents on click
			 */
			_entry.addEventListener('click', function()
			{
				// Get all the elements in the note wrapper containing valuable text
				const textElems = [...targetNote.getElementsByClassName('notranslate')];

				// Get all the lines, their text content, their type (title, plain text, task or subtask) and their completion status
				const lines = textElems.map(function(_el, _index)
				{
					const text  = _el.innerText.trim();
					const attrs = [..._el.attributes];

					// The first text element is always the title of the note
					if (_index === 0) return { text, type: 'title', completed: false };

					let type      = 'plain';
					let completed = false;

					// The task items have the attribute "aria-label=list item" or "aria-label=parent list item"
					if (attrs.some(_a => _a.nodeName === 'aria-label' && ['list item', 'parent list item'].includes(_a.nodeValue)))
					{
						type = 'task';

						// The subtasks are shifted to the right
						if (_el.parentElement.parentElement.style['margin-left'] !== '0px')
							type = 'subtask';

						// The containers of completed tasks are after a container with the attribute "aria-expanded=true"
						console.log(text);
						for (let sb = _el.parentElement.parentElement.parentElement.previousSibling; sb; sb = sb.previousSibling)
						{
							console.log(sb, [...sb.attributes]);
							if ([...sb.attributes].some(_a => _a.nodeName === 'aria-expanded' && _a.nodeValue === 'true'))
							{
								completed = true;
								break;
							}
						}
					}

					return { text, type, completed };
				})
				// Remove the 'X Completed items' subheader
				.filter(_line => !/Completed items?$/.test(_line.text));

				// Format the contents accordingly
				let formattedContents = '';
				switch (_entry.getAttribute('data-format'))
				{
					case 'md':
						// Format each line according to its type
						formattedContents = lines.map(function(_line)
						{
							const text = parseUrls(_line.text, 'md');

							switch (_line.type)
							{
								case 'title':    return `# ${text}`;
								case 'task':     return `- [${_line.completed ? 'x' : ' '}] ${text}`;
								case 'subtask':  return `  - [${_line.completed ? 'x' : ' '}] ${text}`;
								default:         return text;
							}
						}).join('\n');
						break;

					case 'zim':
						// Discard the title and format each line according to its type
						formattedContents = lines.slice(1).map(function(_line)
						{
							switch (_line.type)
							{
								case 'task':     return `[${_line.completed ? '*' : ' '}] ${_line.text}`;
								case 'subtask':  return `\t[${_line.completed ? '*' : ' '}] ${_line.text}`;
								default:         return _line.text;
							}
						}).join('\n');
						break;

					case 'html':
						// Format each line according to its type
						formattedContents = lines.map(function(_line, _index)
						{
							const text = parseUrls(_line.text, 'html');

							if (_line.type == 'title')
								return `<h1>${text}</h1>`;

							if (['task', 'subtask'].includes(_line.type))
								return `<input type="checkbox" id="task-${_index}"${_line.completed ? ' checked': ''}>`
								     + `<label for="task-${_index}">${text}</label>`;

							return `<p>${text}</p>`;
						}).join('\n');
						break;

					case 'csv':
						// Discard the title and join the lines with commas
						formattedContents = lines.slice(1).map(_line => _line.text).join(',');
						break;

					case 'plain':
					default:
						// Simply output all the lines one after the other
						formattedContents = lines.map(_line => _line.text).join('\n');
						break;
				}

				// Copy the formatted contents of the note to the clipboard
				copyToClipboard(formattedContents);
				console.log(formattedContents);

				// Close the context menu
				_entry.parentElement.setAttribute('tabindex', -1);
				_entry.parentElement.style.display = 'none';
			});
		});
	}))
	.observe(document.body, {
		childList: true,
		subtree: true
	});

	/**
	 * Parse the URLs contained in a string into a specific format and return the modified string
	 */
	function parseUrls(str, format)
	{
		const urls = /https?:\/\/\S+?\.\S+/g;

		switch (format)
		{
			case 'html':  return str.replace(urls, '<a href="$&">$&</a>');
			case 'md':    return str.replace(urls, '[$&]($&)');

			default:      return str;
		}
	}

	/**
	 * Copy a string into the system clipboard
	 */
	function copyToClipboard(_str)
	{
		// Create an invisible textarea containing the string to copy
		const ta = createNewElement('textarea', {
			style: {
				position:  'absolute',
				left:      '-9999px',
			},
			readonly: true,
		}, _str);

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
	function createNewMenuEntry(_wrapperAttrs, _innerAttrs, _text)
	{
		const wrapper = createNewElement('div', _wrapperAttrs);
		const inner   = createNewElement('div', _innerAttrs, _text);

		wrapper.appendChild(inner);

		return wrapper;
	}

	/**
	 * Create a new DOM element
	 */
	function createNewElement(_type, _attrs, _textContent = null)
	{
		const el = document.createElement(_type);

		// Set the attributes
		Object.keys(_attrs).forEach(function(_attr)
		{
			let val = _attrs[_attr];

			// If the attribute value is a boolean set to 'true', set it to an empty string
			if (val === true) val = '';

			// If the attribute value is an object (used to set the 'style' attribute)
			else if (val === Object(val) && Object.prototype.toString.call(val) !== '[object Array]')
			{
				// Join the key-value pairs in a single string
				val = Object.keys(val)
					.reduce((__acc, __key) => { __acc.push(`${__key}: ${val[__key]};`); return __acc; }, [])
					.join(' ');
			}

			el.setAttribute(_attr, val);
		});

		// Set the text content
		if (_textContent) el.textContent = _textContent;

		return el;
	}

	/**
	 * Return the current colorscheme ('dark' or 'light')
	 */
	function getColorscheme()
	{
		return document.getElementById('gb').style.cssText === 'background-color: rgb(255, 255, 255);' ? 'light' : 'dark';
	}
})();
