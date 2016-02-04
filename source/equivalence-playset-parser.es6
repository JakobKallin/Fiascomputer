import R from 'ramda';
import { even } from 'utils';

// This parser was originally written before the external interface was
// finalized and it has not been completely updated to reflect this internally,
// so some of the internal logic does not match the external interface.
export default function parsePlayset(pdfPages) {
    const pages = {};
    return Promise.all(Object.keys(pdfPages).map(name => {
        return Array.isArray(pdfPages[name])
            ? Promise.all(pdfPages[name].map(p => p.getTextContent())).then(ts => pages[name] = ts)
            : pdfPages[name].getTextContent().then(t => pages[name] = t);
    }))
    .then(() => parsePages(pages));
    
    function parsePages(pages) {
        const tables = extractTables(R.flatten([
            pages.relationships,
            pages.needs,
            pages.locations,
            pages.objects
        ]));
        const playset = {
            tables: {
                relationships: tables[0],
                needs: tables[1],
                locations: tables[2],
                objects: tables[3]
            }
        };
        
        if ( 'title' in pages ) {
            playset.title = extractTitle(pages.title);
        }
        
        // We need to return a single subtitle, not one per spread, so simply
        // use the first one; they should be identical, and if they aren't, we
        // don't necessarily have a good way of finding out which is the correct
        // one.
        const subtitle = playset.tables.relationships.subtitle;
        Object.keys(playset.tables).forEach(key => {
            delete playset.tables[key].subtitle;
        });
        playset.subtitle = subtitle;
        
        return playset;
    }
    
    function extractTitle(page) {
        const tokens = page.items.map(i => i.str);
        return R.takeWhile(s => s.toLowerCase() != 'credits', tokens).join('').trim();
    }
    
    function extractTables(tablePages) {
        const pageItems = tablePages.map(mergeItemsWithStyles)
        const pageClasses = pageItems.map(items => findClasses(items));
        const tables = R.range(0, tablePages.length).filter(even).map(num => {
            const items = R.concat(pageItems[num], pageItems[num + 1]);
            const classes = mergeClasses(pageClasses[num], pageClasses[num + 1]);
            try {
                return tableFromItems(items, classes);
            }
            catch(e) {
                throw new Error(e.message + ', pages ' + (num+1) + '-' + (num+2));
            }
        });
        return tables;
    }
    
    function mergeItemsWithStyles(page) {
        return page.items.map(i1 => {
            const i2 = R.clone(i1);
            i2.style = page.styles[i2.fontName];
            return i2;
        });
    }
    
    function essence(item) {
        return {
            height: item.height,
            style: {
                fontFamily: item.style.fontFamily
            }
        };
    }
    
    function match(a, b) {
        return R.equals(essence(a), essence(b));
    }
    
    // Given a set of uncategorized items and a set of items grouped into
    // equivalence classes, add the uncategorized items to the existing classes
    // and/or create new classes for them.
    function findClasses(items) {
        return items.reduce((classes, item) => {
            // Find the class containing the current item. Assuming the classes
            // have been correctly defined, at most one will match.
            const matching = R.findIndex(c => match(c, item), classes);
            return matching === -1
                // If there is no matching class, create a new one.
                ? R.append(essence(item), classes)
                // If there is a matching class, we don't need to add anything.
                : classes;
        }, []);
    }
    
    function mergeClasses(c1, c2) {
        return R.uniq(R.concat(c1, c2));
    }
    
    function mergeItems(i1, i2) {
        var i3 = R.clone(i1);
        i3.str += i2.str;
        return i3;
    }
    
    function tableFromItems(items, classes) {
        const mergedItems = items.reduce((merged, current) => {
            if ( merged.length > 0 && match(current, R.last(merged)) ) {
                return R.adjust(
                    previous => mergeItems(previous, current),
                    merged.length - 1,
                    merged
                );
            }
            else {
                return R.append(current, merged);
            }
        }, []);
        const itemsByClass = classes.map(c => mergedItems.filter(i => match(c, i)));
        
        const titleClasses = itemsByClass.filter(c => c.length === 2);
        const title = titleClasses.length === 1 ? titleClasses[0][0].str : '';
        const subtitle = titleClasses.length === 1 ? titleClasses[0][1].str : '';
        
        const categoryClass = R.find(c => c.length === 6, itemsByClass);
        if ( !categoryClass ) {
            error('NOT_6_CATEGORIES');
        }
        
        const elementClass = findElementClass(itemsByClass);
        if ( !elementClass ) {
            error('NOT_36_ELEMENTS')
        }
        
        const elements = elementClass.map(i => i.str);
        return {
            title: title,
            subtitle: subtitle,
            categories: [
                { name: formatCategory(categoryClass[0].str), elements: elements.slice(0, 6) },
                { name: formatCategory(categoryClass[1].str), elements: elements.slice(6, 12) },
                { name: formatCategory(categoryClass[2].str), elements: elements.slice(12, 18) },
                { name: formatCategory(categoryClass[3].str), elements: elements.slice(18, 24) },
                { name: formatCategory(categoryClass[4].str), elements: elements.slice(24, 30) },
                { name: formatCategory(categoryClass[5].str), elements: elements.slice(30, 36) }
            ]
        };
    }
    
    function formatCategory(string) {
        return string.replace(/^\s*\d/, '').trim();
    }
    
    function findElementClass(itemsByClass) {
        const largeClasses = itemsByClass.filter(items => items.length === 6 * 6);
        return largeClasses.filter(c => !c.every(isOneCharacter))[0];
    }
    
    function isOneCharacter(item) {
        return item.str.trim().length === 1;
    }
    
    function error(message) {
        throw new Error(message);
    }
}
