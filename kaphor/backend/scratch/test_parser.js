const ALL_LABELS = [
    'Rental / Week', 'Rental / Day', 'Sleeve Type', 'Fit / Shape',
    'Description', 'Condition', 'Category', 'Pattern', 'Per Week', 'Per Day',
    'Fabric', 'Brand', 'Title', 'Price', 'Style', 'Sleeve', 'Color', 'Size'
];

const block = `Title
White Chikankari Lehenga with Multicolour Patchwork Blouse & Dupatta
Description
A stunning white chikankari lehenga with intricate self-fabric embroidery throughout the skirt. Paired with a vibrant multicolour patchwork blouse in red, yellow, navy, and ivory block-print geometric panels. The matching dupatta carries the same bold patchwork design with decorative borders. Ideal for Navratri, Garba, mehendi, or festive celebrations.
Brand
Unknown
Category
Apparel
Size
L
Condition
Excellent
Rental / Day
₹800
Rental / Week
₹4,500
Fabric
Cotton Chikankari (Lehenga) / Printed Cotton (Blouse & Dupatta)
Color
White with Multicolour Patchwork
Style
Ethnic / Festive
Sleeve Type
Short Sleeve Blouse
Fit / Shape
Flared Lehenga
Pattern
Chikankari + Patchwork Print`;

function parse(block) {
    const labelMatches = [];
    for (const label of ALL_LABELS) {
        const regexA = new RegExp(`${label}:`, 'gi');
        let m;
        while ((m = regexA.exec(block)) !== null) labelMatches.push({ label, index: m.index, length: label.length + 1 });
        
        const regexB = new RegExp(`^\\s*${label}\\s*$`, 'gim');
        while ((m = regexB.exec(block)) !== null) {
            labelMatches.push({ label, index: m.index, length: m[0].length });
        }
    }

    labelMatches.sort((a, b) => a.index - b.index);
    const filtered = [];
    for (const m of labelMatches) if (!filtered.find(f => f.index <= m.index && (f.index + f.length) > m.index)) filtered.push(m);

    const values = {};
    for (let i = 0; i < filtered.length; i++) {
        const curr = filtered[i];
        const next = filtered[i+1];
        values[curr.label] = block.substring(curr.index + curr.length, next ? next.index : block.length).trim();
    }
    return values;
}

console.log(JSON.stringify(parse(block), null, 2));
