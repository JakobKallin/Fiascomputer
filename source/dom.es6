export function clear(node) {
    while ( node.firstChild ) {
        node.removeChild(node.firstChild);
    }
}

export function remove(node) {
    return node.parentNode.removeChild(node);
}

export function all(selector, node) {
    node = node || document;
    return [].slice.call(node.querySelectorAll(selector));
}

export function first(selector, node) {
    node = node || document;
    return node.querySelector(selector)
}

export function id(id) {
    return document.getElementById(id);
}

export function set(element, attribute, value) {
    if ( value === null ) {
        element.removeAttribute(attribute);
    }
    else {
        element[attribute] = value;
    }
}

export function on(node, event, listener) {
    node.addEventListener(event, listener);
}

export function capture(node, event, listener) {
    node.addEventListener(event, listener, true);
}

// Attach a change listener to a select control and trigger it once right away.
export function select(node, listener, initial) {
    const domListener = () => {
        listener(node.value);
    };
    on(node, 'change', domListener);
    if ( initial !== undefined ) {
        node.value = initial;
    }
    domListener();
}

export function toggleClass(node, table) {
    Object.keys(table).forEach(className => {
        const value = table[className];
        value ? node.classList.add(className) : node.classList.remove(className);
    });
}

export function selectFiles() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'application/pdf';
        on(input, 'change', event => {
            resolve([].slice.call(input.files));
        });
        input.style.display = 'none';
        // TODO: The input should be removed as soon as possible (which is
        // probably the next time files are selected, leaving at most one input
        // in the document at any given point in time).
        document.body.appendChild(input);
        input.click();
    });
}

export function drag(node, callbacks) {
    on(node, 'dragover', event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        callbacks.before();
    });
    
    on(node, 'drop', event => {
        event.preventDefault();
        callbacks.drop([].slice.call(event.dataTransfer.files));
        callbacks.after();
    });
    
    on(node, 'dragleave', event => {
        callbacks.after();
    });
}

export function replicate(values, template, container, callback) {
    clear(container);
    if ( !Array.isArray(values) ) {
        values = [values];
    }
    values.forEach((value, index) => {
        const instance = template.cloneNode(true);
        container.appendChild(instance);
        callback(instance, value, index);
    });
}

export function key(event) {
    return {
        13: 'enter',
        27: 'escape',
        37: 'left',
        39: 'right'
    }[event.which] || event.which;
}

export function makeEditable(options) {
    const editableNode = options.node;
    const triggerNode = options.trigger;
    
    on(triggerNode, 'click', () => {
        editableNode.contentEditable = 'true';
        editableNode.focus();
        document.execCommand('selectAll', false, null);
        if ( options.focus ) {
            options.focus();
        }
    });
    on(editableNode, 'blur', () => {
        // Make sure that nodes cannot "disappear" by having their contents
        // emptied and suddenly no longer taking up any height.
        if ( editableNode.textContent.trim() === '' ) {
            editableNode.innerHTML = '&nbsp;';
        }
        if ( options.change ) {
            options.change(editableNode.textContent);
        }
    });
    on(editableNode, 'paste', event => {
        // Plain text copying
        event.preventDefault();
        editableNode.textContent = event.clipboardData.getData('text/plain');
    });
    on(editableNode, 'keydown', event => {
        if ( key(event) === 'escape' || key(event) === 'enter' ) {
            event.preventDefault();
            editableNode.blur();
        }
    });
    on(editableNode, 'blur', () => {
        editableNode.contentEditable = 'false';
        if ( options.blur ) {
            options.blur();
        }
    });
    
    // If the element is an editable link, we want to prevent the link from
    // working. While removing the `href` would also work, that would not stop
    // `click` event listeners from taking effect.
    if ( options.node.tagName === 'A' ) {
        capture(options.node.parentNode, 'click', event => {
            if ( options.node.isContentEditable ) {
                event.stopPropagation();
            }
        });
    }
}

export function matches(element, selector) {
    if ( element.matches ) {
        return element.matches(selector);
    }
    else {
        return element.msMatchesSelector(selector);
    }
}

export function closest(element, selector) {
    if ( element.closest ) {
        return element.closest(selector);
    }
    else {
        return msClosest(element, selector);
    }
}

function msClosest(element, selector) {
    if ( !element ) {
        return element;
    }
    else if ( matches(element, selector) ) {
        return element;
    }
    else {
        return msClosest(element.parentNode, selector);
    }
}

export function origin(link) {
    if ( link.origin ) {
        return link.origin;
    }
    else {
        return link.protocol + '//' + link.hostname;
    }
}
