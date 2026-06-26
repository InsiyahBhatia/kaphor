import { PrismaClient, ListingType, GarmentCondition, UserRole } from '@prisma/client';
import { ImpactService } from '../src/services/impact.service';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STYLE_VECTOR_LENGTH = 16;
const defaultVector = () => Array.from({ length: STYLE_VECTOR_LENGTH }, () => Math.random() * 0.4 - 0.2);

const ALL_LABELS = [
    'Rental / Week', 'Rental / Day', 'Sleeve Type', 'Fit / Shape',
    'Description', 'Condition', 'Category', 'Pattern', 'Per Week', 'Per Day',
    'Fabric', 'Brand', 'Title', 'Price', 'Style', 'Sleeve', 'Color', 'Size'
];

async function main() {
    console.log('Seeding garment collection with impact data...');
    
    // 1. Setup Users
    const passwordHash = await bcrypt.hash('KaphorDemo123!', 12);
    const userEmails = ['insiyahmbhatia@gmail.com', 'ambhatia1113@gmail.com'];
    const users: any[] = [];
    
    for (const email of userEmails) {
        let user = await prisma.user.upsert({
            where: { email },
            update: { role: 'BOTH', isVerified: true, onboardingDone: true, styleVector: defaultVector() },
            create: { 
                email, 
                username: email.split('@')[0], 
                displayName: email.split('@')[0].toUpperCase(), 
                passwordHash, 
                role: 'BOTH', 
                isVerified: true, 
                onboardingDone: true, 
                styleVector: defaultVector() 
            }
        });
        users.push(user);
    }

    // 2. Clear Existing Data
    await prisma.rental.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.swap.deleteMany();
    await prisma.behaviourSignal.deleteMany();
    await prisma.behaviourEvent.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.garment.deleteMany();

    // 3. Load Catalogue
    const cataloguePath = path.join(__dirname, '../scratch/catalogue_text.txt');
    if (!fs.existsSync(cataloguePath)) {
        console.error('Catalogue file not found at:', cataloguePath);
        return;
    }
    const catalogueText = fs.readFileSync(cataloguePath, 'utf8');
    const sections = catalogueText.split(/---\s*(WOMEN|MEN|THRIFT)\s*---/i);

    let globalIndex = 0;

    for (let i = 1; i < sections.length; i += 2) {
        const categoryLabel = sections[i];
        const content = sections[i + 1];
        if (!content) continue;

        if (categoryLabel === 'WOMEN' || categoryLabel === 'MEN') {
            const blocks = content.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 50);
            for (let j = 0; j < blocks.length; j++) {
                // Determine image path based on category
                const prefix = categoryLabel === 'MEN' ? 'm' : '';
                const imgPath = `/uploads/rentals/${prefix}${j + 1}.jpeg`;
                const fullImgPath = path.join(process.cwd(), imgPath);

                if (fs.existsSync(fullImgPath)) {
                    const data = await parseMegaRobustBlock(blocks[j], ListingType.RENTAL);
                    const user = users[globalIndex % 2];
                    globalIndex++;

                    await prisma.garment.create({
                        data: {
                            ...data,
                            sellerId: user.id,
                            images: [imgPath],
                            listingType: ListingType.RENTAL,
                            lifecycleState: 'LISTED',
                            garmentVector: defaultVector()
                        }
                    });
                }
            }
        } else if (categoryLabel === 'THRIFT') {
            const parts = content.split('KAPHOR ACCESSORIES DATA');
            
            // Sale items (Thrift)
            const thriftBlocks = parts[0].split(/\n\d+\.\s/).map(b => b.trim()).filter(b => b.length > 30);
            for (let j = 0; j < thriftBlocks.length; j++) {
                const imgPath = `/uploads/thrift/${j + 1}.jpeg`;
                const fullImgPath = path.join(process.cwd(), imgPath);

                if (fs.existsSync(fullImgPath)) {
                    const data = await parseMegaRobustBlock(thriftBlocks[j], ListingType.SALE);
                    const user = users[globalIndex % 2];
                    globalIndex++;
                    await prisma.garment.create({
                        data: {
                            ...data,
                            sellerId: user.id,
                            images: [imgPath],
                            listingType: ListingType.SALE,
                            lifecycleState: 'LISTED',
                            garmentVector: defaultVector()
                        }
                    });
                }
            }

            // Swap items
            if (parts[1]) {
                const accessoryBlocks = parts[1].split(/\n\d+\.\s/).map(b => b.trim()).filter(b => b.length > 30);
                for (let j = 0; j < accessoryBlocks.length; j++) {
                    const imgPath = `/uploads/swaps/${j + 1}.jpeg`;
                    const fullImgPath = path.join(process.cwd(), imgPath);

                    if (fs.existsSync(fullImgPath)) {
                        const data = await parseMegaRobustBlock(accessoryBlocks[j], ListingType.ACCESSORY_SWAP);
                        const user = users[globalIndex % 2];
                        globalIndex++;
                        await prisma.garment.create({
                            data: {
                                ...data,
                                sellerId: user.id,
                                images: [imgPath],
                                listingType: ListingType.ACCESSORY_SWAP,
                                lifecycleState: 'LISTED',
                                garmentVector: defaultVector()
                            }
                        });
                    }
                }
            }
        }
    }

    console.log(`Seed completed successfully. Total valid items with images: ${await prisma.garment.count()}`);
}

async function parseMegaRobustBlock(block: string, type: ListingType): Promise<any> {
    const labelMatches: { label: string, index: number, length: number }[] = [];
    for (const label of ALL_LABELS) {
        const regexA = new RegExp(`${label}:`, 'gi');
        let m;
        while ((m = regexA.exec(block)) !== null) labelMatches.push({ label, index: m.index, length: label.length + 1 });
        
        const regexB = new RegExp(`^\\s*${label}\\s*$`, 'gim');
        while ((m = regexB.exec(block)) !== null) labelMatches.push({ label, index: m.index, length: m[0].length });
    }

    labelMatches.sort((a, b) => a.index - b.index);
    const filtered: typeof labelMatches = [];
    for (const m of labelMatches) if (!filtered.find(f => f.index <= m.index && (f.index + f.length) > m.index)) filtered.push(m);

    const values: Record<string, string> = {};
    for (let i = 0; i < filtered.length; i++) {
        const curr = filtered[i];
        const next = filtered[i+1];
        values[curr.label] = block.substring(curr.index + curr.length, next ? next.index : block.length).trim();
    }

    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0]?.replace(/^\d+\.\s*/, '') || 'Kaphor Archive';
    
    let title = values['Title'] || firstLine;
    title = title.replace(/Description:?|Brand:?|Price:?/gi, '').trim();

    const parsePrice = (v: string, def: number) => {
        const n = (v || '').match(/[\d,]+/);
        return (parseInt(n ? n[0].replace(/,/g, '') : '0') || def) * 100;
    };

    const condition = (values['Condition'] || '').toUpperCase().includes('GOOD') ? GarmentCondition.MINOR_WEAR : GarmentCondition.PRISTINE;
    const fabric = values['Fabric'] || values['Material'] || null;

    const res: any = {
        title, 
        description: values['Description'] || title,
        brand: values['Brand'] || 'Unknown',
        fabric,
        materialId: await ImpactService.findMatchingMaterialId(title, 'APPAREL', fabric),
        category: values['Category'] || (type === 'RENTAL' ? 'Sarees' : 'Apparel'),
        size: values['Size'] || 'OS',
        condition,
        color: (values['Color'] || '').split(/&|,/).map(s => s.trim()).filter(Boolean),
        style: values['Style'] || values['Fit / Shape'] || 'Archive Classic',
        pattern: values['Pattern'] || 'Solid / Intricate',
        sleeve: values['Sleeve Type'] || values['Sleeve'] || 'N/A'
    };

    if (type === 'RENTAL') {
        res.rentalPriceDay = parsePrice(values['Rental / Day'] || values['Per Day'], 500);
        res.rentalPriceWeek = parsePrice(values['Rental / Week'] || values['Per Week'], 2500);
    } else if (type === 'SALE') {
        res.price = parsePrice(values['Price'], 1500);
    } else {
        res.price = parsePrice(values['Price'], 800);
    }
    return res;
}

main()
    .catch((e: Error) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
