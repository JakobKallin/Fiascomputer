import R from 'ramda';

export default function parsePlayset(pdfPages) {
    const pages = {};
    return Promise.all(Object.keys(pdfPages).map(name => {
        return Array.isArray(pdfPages[name])
            ? Promise.all(pdfPages[name].map(loadPageTokens)).then(ts => pages[name] = ts)
            : loadPageTokens(pdfPages[name]).then(t => pages[name] = t);
    }))
    .then(() => {
        const playset = {
            tables: {
                relationships: parseSpread(pages.relationships[0], pages.relationships[1]),
                needs: parseSpread(pages.needs[0], pages.needs[1]),
                locations: parseSpread(pages.locations[0], pages.locations[1]),
                objects: parseSpread(pages.objects[0], pages.objects[1])
            }
        };
        
        if ( 'title' in pages ) {
            playset.title = parseTitlePage(pages.title);
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
    });
}

function loadPageTokens(page) {
    return page.getTextContent()
    .then(text => {
        return text.items.map(i => i.str);
    });
}

function parseSpread(pageOneTokens, pageTwoTokens, options) {
    options = options || { categories: 6, elements: 6 };
    
    const pageOne = splitPage(pageOneTokens, 1);
    const pageTwo = splitPage(pageTwoTokens, options.categories / 2 + 1);
    
    const title = pageOne.titleTokens.join('').trim();
    const subtitle = pageTwo.titleTokens.join('').trim();
    
    const tableTokens = pageOne.tableTokens.concat(pageTwo.tableTokens);
    const categories = parseCategories(tableTokens, options);
    
    return {
        title: title,
        subtitle: subtitle,
        categories: categories
    };
}

function parseCategories(tokens, options) {
    tokens = tokens.slice(); // Copy
    const before = takeUntil(t => isBoundary(t, 1));
    
    const categories = R.range(1, options.categories + 1).map(category => {
        // We take one token (because the next one starts with the category
        // number 1 and we need that one regardless), then take tokens until we
        // find the next number 1, which this time denotes the first element.
        const nameTokens = [takeOne()].concat(takeUntil(t => isBoundary(t, 1)));
        const name = formatName(nameTokens, category);
        const elements = parseElements(category);
        return {
            name: name,
            elements: elements
        };
    });
    
    return categories;
    
    function parseElements(category) {
        const nextCategory = category + 1;
        return R.range(1, options.elements + 1).map(element => {
            const nextElement = element + 1;
            // Similar to above, we need the first token regardless. Provide the
            // empty string as a fallback to avoid errors in playsets with
            // incorrect numbering.
            const firstNameToken = takeOne() || '';
            const nextNumber =
                nextElement === options.elements + 1
                ? nextCategory
                : nextElement;
            // If the first name token contains only the element number, we know
            // that we must take the next token as well regardless of how it
            // starts. This avoids the edge case of an element name starting
            // with the number of the next element. TODO: Possibly apply this to
            // category names as well.
            const otherNameTokens = firstNameToken.trim() === String(element)
                ? [takeOne()].concat(takeUntil(t => isBoundary(t, nextNumber)))
                : takeUntil(t => isBoundary(t, nextNumber));
            const nameTokens = [firstNameToken].concat(otherNameTokens);
            const name = formatName(nameTokens, element);
            return name;
        });
    }
    
    function takeOne() {
        // If there are no tokens left, return the empty string rather than a
        // null value, to remove edge cases caused by too few available
        // categories/elements (specifically due to incorrect numbering).
        if ( tokens.length === 0 ) {
            return '';
        }
        else {
            const t = tokens[0];
            tokens = tokens.slice(1);
            return t;
        }
    }
    
    function takeUntil(predicate) {
        const ts = R.takeWhile(t => !predicate(t), tokens);
        tokens = tokens.slice(ts.length);
        return ts;
    }
}

function formatName(tokens, number) {
    if ( isLetterNumberToken(tokens[0], number) ) {
        return R.drop(1, tokens).join('').trim();
    }
    else {
        return R.dropWhile(c => c == number, tokens.join('')).join('').trim();
    }
}

function splitPage(tokens, firstCategory) {
    const tokensBefore = R.takeWhile(t => !isBoundary(t, firstCategory) || startsWithPageNumber(t), tokens);
    if ( tokensBefore.length === 0 ) {
        return {
            titleTokens: [R.last(tokens)],
            tableTokens: R.dropLast(1, tokens)
        };
    }
    else {
        return {
            titleTokens: tokensBefore,
            tableTokens: R.drop(tokensBefore.length, tokens)
        };
    }
}

function isBoundary(token, nextNumber) {
    const number = token.trim().startsWith(String(nextNumber));
    const letter = isLetterNumberToken(token, nextNumber);
    return number || letter;
}

function startsWithPageNumber(token) {
    const number = parseInt(token);
    return !isNaN(number) && number >= 10;
}

function isLetterNumberToken(token, number) {
    const aCode = 'a'.charCodeAt(0);
    const numberString = String.fromCharCode(aCode + number - 1);
    return token.trim().length === 1 && token.trim().toLowerCase() === numberString;
}

function parseTitlePage(tokens) {
    const text = tokens.join('');
    const creditIndex = text.toLowerCase().indexOf('credits');
    const truncated = creditIndex === -1 ? text : text.substring(0, creditIndex);
    return truncated.substring(0, 100).trim();
}
