import * as dom from 'dom';
import R from 'ramda';

export default function(page, signal) {
    const linkHref = '/setup';
    
    const pageNode = dom.id('table');
    const templates = {
        element: dom.remove(dom.first('.element-name', pageNode)),
        category: dom.remove(dom.first('.category', pageNode))
    };
    
    const tableNode = dom.first('.table', pageNode);
    const categoriesNode = dom.first('.categories', tableNode);
    R.range(0, 6).forEach(category => {
        categoriesNode.appendChild(showCategory(category));
    });
    
    dom.makeEditable({
        node: dom.first('.table-subtitle-text', tableNode),
        trigger: dom.first('.edit', dom.first('.table-subtitle', tableNode)),
        change: text => signal.changeSubtitle(text)
    });

    function showCategory(category) {
        const node = templates.category.cloneNode(true);
        const link = dom.first('.category-link', node);
        link.href = linkHref;
        dom.on(link, 'click', event => {
            signal.selectCategory(category);
        });
        dom.on(link, 'input', event => {
            signal.changeCategory(category, link.textContent);
        });
        const elementsNode = dom.first('.elements', node);
        R.range(0, 6).forEach((element) => {
            elementsNode.appendChild(showElement(category, element));
        });
        dom.makeEditable({
            node: link,
            trigger: dom.first('.edit', node),
            change: text => signal.changeCategory(category, text),
            focus: () => link.removeAttribute('href'),
            blur: () => link.href = linkHref
        });
        return node;
    }
    
    function showElement(category, element) {
        const node = templates.element.cloneNode(true);
        const link = dom.first('.element-link', node);
        link.href = linkHref;
        dom.on(link, 'click', event => {
            signal.selectElement(category, element);
        });
        dom.on(link, 'input', event => {
            signal.changeElement(category, element, link.textContent);
        });
        dom.makeEditable({
            node: link,
            trigger: dom.first('.edit', node),
            change: text => signal.changeElement(category, element, text),
            focus: () => link.removeAttribute('href'),
            blur: () => link.href = linkHref
        });
        return node;
    }
    
    return {
        renderTable: (table, selectedCategory) => {
            dom.toggleClass(pageNode, {
                'single-category': selectedCategory !== null,
                'multiple-categories': selectedCategory === null
            });
            
            dom.first('.table-title', tableNode).textContent = table.title;
            dom.first('.table-subtitle-text', tableNode).textContent = table.subtitle;
            dom.all('.category', tableNode).forEach((categoryNode, category) => {
                dom.first('.category-link', categoryNode).textContent = table.categories[category];
                dom.all('.element-link', categoryNode).forEach((elementNode, element) => {
                    elementNode.textContent = table.elements[category][element];
                });
                
                dom.toggleClass(categoryNode, {
                    disabled: selectedCategory !== null && category !== selectedCategory
                });
            });
        },
        close: () => dom.id('close-table-control', page).click()
    };
}
