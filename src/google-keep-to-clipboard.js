
/**
 * google-keep-to-clipboard.js
 *
 * A browser extension to copy the contents of Google Keep notes into
 * the clipoard in various formats.
 *
 * Copyright © 2019 cheap-glitch
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses.
 */

"use strict";

(function()
{
	// {{{ Kaomojis
	const kaoSuccess = [
		'✧*｡٩(ˊᗜˋ*)و✧*｡',
		'o(≧∇≦o)',
		'」(￣▽￣」)',
	];
	const kaoError = [
		'°(≧Д≦)°',
		'ʅฺ(・ω・;)ʃฺ',
	];
	// }}}

	let targetNote	    = null;
	let entryAdded	    = false;
	let entriesDisabled = false;

	// Get all the context menu handles (the three little dots in the toolbar of each note)
	const menuHandles = [...document.querySelectorAll('div[role="toolbar"] div[aria-label="More"]')].slice(2);

	// Add a click event handler on each menu handle to know which note is being targeted
	menuHandles.forEach(_handle => _handle.addEventListener('click', function()
	{
		// Set the target note to the grand-grand-parent of the handle
		targetNote = _handle.parentElement.parentElement.parentElement;
	}));

	// Wait for the contextual menu to be created in the <body> element to insert a new entry in it
	(new MutationObserver(function()
	{
		const lastEntry = document.getElementById(':9');
		if (entryAdded || !lastEntry) return;

		const menuEntryTextClass   = lastEntry.children.item(0).className;
		const submenuEntryTextAttr = `class="${menuEntryTextClass}" style="padding-left: 20px;"`;
		const submenuEntryAttr	   = `class="google-keep-to-clipboard-submenu-entry ${lastEntry.className}"
					      role="menuitem"
					      style="user-select: none;"`;

		// Insert a new menu entry and its submenu
		lastEntry.insertAdjacentHTML(
			'afterend',
			`<div
				id="google-keep-to-clipboard"
				class="${lastEntry.className}"
				style="user-select: none; padding: 0; border: none;"
				role="menuitem"
				>
				<div
					class="${menuEntryTextClass}"
					style="padding: 5px 10px 5px 17px;"
					>
					Copy to clipboard as&hellip;
				</div>
				<div
					id="google-keep-to-clipboard-submenu"
					style="display: none;"
					>
					<div ${submenuEntryAttr}><div ${submenuEntryTextAttr} data-format="plain">Plain text</div></div>
					<div ${submenuEntryAttr}><div ${submenuEntryTextAttr} data-format="md">Markdown</div></div>
					<div ${submenuEntryAttr}><div ${submenuEntryTextAttr} data-format="zim">Zim markup</div></div>
					<div ${submenuEntryAttr}><div ${submenuEntryTextAttr} data-format="html">HTML</div></div>
					<div ${submenuEntryAttr}><div ${submenuEntryTextAttr} data-format="csv">CSV</div></div>
				</div>
			</div>`
		);
		entryAdded = true;

		const newEntry	      = document.getElementById('google-keep-to-clipboard');
		const newEntrySubmenu = document.getElementById('google-keep-to-clipboard-submenu');

		newEntry.addEventListener('mouseover', function()
		{
			// Set the background color according to the current colorscheme
			newEntry.style.backgroundColor = (getColorscheme() === 'light') ? '#ebebeb' : '#444547';

			// Open the formatting menu
			newEntrySubmenu.style.backgroundColor = (getColorscheme() === 'light') ? 'white' : '#202124';
			newEntrySubmenu.style.display = 'block';
		});
		newEntry.addEventListener('mouseout', function()
		{
			newEntry.style.backgroundColor = 'transparent';

			// Close the formatting menu
			newEntrySubmenu.style.display = 'none';
		});

		// Add a click handler to every entry of the formatting submenu
		[...document.getElementsByClassName('google-keep-to-clipboard-submenu-entry')].forEach(_entry => _entry.addEventListener('click', () =>
		{
			// Disable the menu entries until the copying is done
			if (entriesDisabled) return;
			entriesDisabled = true;

			// Get all the elements in the note wrapper containing valuable text
			const textElems = [...targetNote.getElementsByClassName('notranslate')];

			// Sort the text elements in two categories : plain text and task item
			const content = textElems.reduce(
				function(_contents, _el)
				{
					// The task items have the attribute 'aria-label="list item"'
					const list = [..._el.attributes].some(_a => _a.nodeName === 'aria-label' && _a.nodeValue === 'list item')
						? 'tasks'
						: 'plain';

					_contents[list].push(_el.innerText);

					return _contents;
				},
				{
					plain: [],
					tasks: [],
				}
			);

			// Copy the text content of the note to the clipboard
			copyToClipboard(`Plain text:\n${content.plain.join('\n')}\nTasks:\n${content.tasks.join('\n')}`);

			// Display a success message
			const entryText	    = _entry.children.item(0);
			const oldInnerText  = entryText.innerText;
			entryText.innerText = `Copied! ${kaoSuccess[Math.floor(Math.random()*kaoSuccess.length)]}`;

			// Reset the entry text after two seconds have passed
			window.setTimeout(function()
			{
				entriesDisabled     = false;
				entryText.innerText = oldInnerText;
			}, 2000);
		}));
	}))
	.observe(document.body, {
		childList: true,
		subtree: true
	});

	/**
	 * Return the current colorscheme ('dark' or 'light')
	 */
	function getColorscheme()
	{
		return document.getElementById('gb').style.cssText === 'background-color: rgb(255, 255, 255);' ? 'light' : 'dark';
	}

	/**
	 * Copy a string into the system clipboard
	 */
	function copyToClipboard(_str)
	{
		// Create an invisible textarea containing the string to copy
		const ta = document.createElement('textarea');
		ta.value = _str;
		ta.style.left = '-9999px';
		ta.style.position = 'absolute';
		ta.setAttribute('readonly', '');

		// Add it to the DOM
		document.body.appendChild(ta);

		// Select its contents and copy them into the clipboard
		ta.select();
		document.execCommand('copy');

		// Remove the textarea
		document.body.removeChild(ta);
	};
})();
