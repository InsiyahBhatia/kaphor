const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CLOUDINARY_PREFIX = 'https://res.cloudinary.com/bcwibvye/image/upload/f_auto,q_auto/';

// Comprehensive truthful metadata mapped by filename
const THRIFT_UPDATES = {
  '1': {
    title: 'Bewakoof Heather Grey Crewneck T-Shirt',
    category: 'Tops',
    subCategory: 'T-Shirts',
    brand: 'Bewakoof',
    description: 'Essential heather grey crewneck t-shirt in soft cotton jersey with rolled cuffs and a relaxed everyday fit.',
    color: ['Grey'],
    fabric: 'Cotton Jersey',
    style: 'Casual',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '2': {
    title: 'Zara Metallic Bronze Pleated V-Neck Top',
    category: 'Tops',
    subCategory: 'Party Tops',
    brand: 'Zara',
    description: 'Statement sleeveless party top in shimmering metallic bronze pleated fabric featuring a plunging V-neckline.',
    color: ['Bronze', 'Brown'],
    fabric: 'Pleated Polyester',
    style: 'Evening Glam',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '3': {
    title: 'Navy Blue Linen Button-Placket Tunic Top',
    category: 'Tops',
    subCategory: 'Tunics',
    brand: 'Thrifted',
    description: 'Breezy navy blue linen-cotton tunic top featuring a classic collar and decorative contrast white button placket.',
    color: ['Navy Blue'],
    fabric: 'Linen Cotton',
    style: 'Casual Minimalist',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '4': {
    title: 'Sage Khaki Utility Cargo Trousers',
    category: 'Bottoms',
    subCategory: 'Cargos & Trousers',
    brand: 'Thrifted',
    description: 'High-waisted utility cargo trousers in sage khaki green with deep flap pockets and relaxed straight silhouette.',
    color: ['Sage Green', 'Khaki'],
    fabric: 'Cotton Twill',
    style: 'Streetwear Utility',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '5': {
    title: 'Off-White Relaxed Linen Drawstring Trousers',
    category: 'Bottoms',
    subCategory: 'Trousers',
    brand: 'Thrifted',
    description: 'Effortless off-white pure linen trousers featuring an adjustable drawstring elastic waistband and straight-leg cut.',
    color: ['Cream', 'Off-White'],
    fabric: 'Pure Linen',
    style: 'Resort Casual',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '6': {
    title: 'Pastel Pink Collared Long-Sleeve Cotton Shirt',
    category: 'Tops',
    subCategory: 'Shirts',
    brand: 'Thrifted',
    description: 'Classic light pink button-down cotton shirt with spread collar, long sleeves, and a clean minimalist silhouette.',
    color: ['Light Pink'],
    fabric: 'Cotton Poplin',
    style: 'Classic Casual',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '7': {
    title: 'Lavender Knit V-Neck Button Cardigan',
    category: 'Jackets',
    subCategory: 'Cardigans',
    brand: 'M12',
    description: 'Cozy pastel lavender knit cardigan featuring a flattering V-neck, patch front pockets, and contrast marble buttons.',
    color: ['Lavender', 'Purple'],
    fabric: 'Knit Cotton Blend',
    style: 'Cozy Casual',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '8': {
    title: 'Picadilly Black Silver Studded V-Neck Blouse',
    category: 'Tops',
    subCategory: 'Blouses',
    brand: 'Picadilly',
    description: 'Chic black V-neck blouse adorned with polished silver studded trims along the neckline and sleeve cuffs.',
    color: ['Black', 'Silver'],
    fabric: 'Stretch Crepe',
    style: 'Smart Casual',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '9': {
    title: 'Blue Marble Swirl Print Straight-Leg Jeans',
    category: 'Denims',
    subCategory: 'Jeans',
    brand: 'Thrifted',
    description: 'Y2K statement denim jeans showcasing a vibrant psychedelic blue and white marble swirl print in a straight-leg cut.',
    color: ['Blue', 'White'],
    fabric: 'Printed Cotton Denim',
    style: 'Y2K Statement',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '10': {
    title: 'Black Pleated High-Waist Tailored Trousers',
    category: 'Bottoms',
    subCategory: 'Trousers',
    brand: 'Thrifted',
    description: 'Tailored black high-rise trousers featuring sharp front pleats and a streamlined straight silhouette.',
    color: ['Black'],
    fabric: 'Poly-Viscose Suiting',
    style: 'Formal Minimalist',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '11': {
    title: 'Classic Blue Distressed Denim Trucker Jacket',
    category: 'Jackets',
    subCategory: 'Denim Jackets',
    brand: 'Thrifted',
    description: 'Timeless mid-wash blue denim trucker jacket with authentic vintage distressing, chest flap pockets, and button front.',
    color: ['Blue'],
    fabric: 'Heavyweight Cotton Denim',
    style: 'Vintage Americana',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '12': {
    title: 'Light Wash Relaxed Straight-Leg Denim Jeans',
    category: 'Denims',
    subCategory: 'Jeans',
    brand: 'Thrifted',
    description: 'Everyday light blue wash denim jeans with a relaxed mid-rise fit and clean straight-leg cut.',
    color: ['Light Blue'],
    fabric: 'Washed Denim',
    style: 'Casual Everyday',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '13': {
    title: 'Black Drawstring Zipper-Pocket Jogger Sweatpants',
    category: 'Bottoms',
    subCategory: 'Joggers',
    brand: 'Thrifted',
    description: 'Comfortable heavyweight black joggers featuring an elastic drawstring waist and sleek metallic silver zipper pockets.',
    color: ['Black'],
    fabric: 'Cotton French Terry',
    style: 'Athleisure',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '14': {
    title: 'J.Artic Black Sleeveless Scoop-Neck Shift Dress',
    category: 'Dresses',
    subCategory: 'Shift Dresses',
    brand: 'J.Artic',
    description: 'Minimalist sleeveless scoop-neck black shift dress with a clean, relaxed drape suited for versatile day-to-night wear.',
    color: ['Black'],
    fabric: 'Rayon Blend',
    style: 'Minimalist Chic',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '15': {
    title: 'Blue & White Floral Tiered Cottagecore Maxi Dress',
    category: 'Dresses',
    subCategory: 'Maxi Dresses',
    brand: 'Thrifted',
    description: 'Charming cottagecore white maxi dress adorned with blue ditsy floral print, puffed ruffle sleeves, and a tiered flared hem.',
    color: ['White', 'Blue'],
    fabric: 'Cotton Georgette',
    style: 'Cottagecore / Bohemian',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '16': {
    title: 'Zudio White Textured Tiered Babydoll Dress',
    category: 'Dresses',
    subCategory: 'Casual Dresses',
    brand: 'Zudio',
    description: 'Breezy babydoll dress in textured white waffle fabric featuring gentle tiered volume and a flattering square neckline.',
    color: ['White'],
    fabric: 'Textured Cotton',
    style: 'Bohemian Casual',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '17': {
    title: 'Zudio White Broderie Lace Peasant Blouse',
    category: 'Tops',
    subCategory: 'Blouses',
    brand: 'Zudio',
    description: 'Romantic white peasant blouse with delicate eyelet broderie lace embroidery, smocked waistline, and flutter sleeves.',
    color: ['White'],
    fabric: 'Cotton Eyelet Lace',
    style: 'Bohemian Romantic',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '18': {
    title: 'Black Open-Knit Crochet Button Cardigan',
    category: 'Tops',
    subCategory: 'Cardigans',
    brand: 'Thrifted',
    description: 'Retro Y2K open-knit black crochet short-sleeve cardigan with button front closures, perfect for lightweight layering.',
    color: ['Black'],
    fabric: 'Open Crochet Knit',
    style: 'Y2K Retro',
    condition: 'PRISTINE',
    listingType: 'SALE'
  },
  '19': {
    title: 'Black Pleated Knit A-Line Midi Skirt',
    category: 'Skirts',
    subCategory: 'Pleated Skirts',
    brand: 'Thrifted',
    description: 'Flowy black knit midi skirt with fine accordion pleating and a flexible elasticated high waistband.',
    color: ['Black'],
    fabric: 'Pleated Jersey Knit',
    style: 'Classic Elegant',
    condition: 'PRISTINE',
    listingType: 'SALE'
  }
};

const SWAP_UPDATES = {
  '1': {
    title: 'Chunky Silver Interlocking Oval Link Chain Belt',
    category: 'Accessories',
    subCategory: 'Belts & Chains',
    brand: 'Vintage',
    description: 'Statement chunky silver metal chain belt featuring interlocking polished oval links and an adjustable lobster claw clasp.',
    color: ['Silver'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '2': {
    title: 'Bohemian Oxidized Silver Medallion Concho Chain Belt',
    category: 'Accessories',
    subCategory: 'Belts',
    brand: 'Boho Vintage',
    description: 'Intricately etched oxidized silver circular medallion concho belt with chain links, ideal for cinching dresses or tunics.',
    color: ['Antique Silver'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '3': {
    title: 'Polished Silver Chunky Hinged Bangle Bracelet',
    category: 'Jewelry',
    subCategory: 'Bracelets',
    brand: 'Artisan Silver',
    description: 'Sleek high-polish silver chunky cuff bangle with a secure concealed hinge mechanism and modern minimalist silhouette.',
    color: ['Silver'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '4': {
    title: 'Architectural Gold Geometric Concentric Square Cuff',
    category: 'Jewelry',
    subCategory: 'Bracelets',
    brand: 'Studio Jewelry',
    description: 'Avant-garde open cuff bracelet crafted from sculptural gold-toned wire in concentric geometric square forms.',
    color: ['Gold'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '5': {
    title: 'Pardor Vintage Square Dial Amber Inlay Bracelet Watch',
    category: 'Watches',
    subCategory: 'Vintage Watches',
    brand: 'Pardor',
    description: 'Collectible Pardor quartz timepiece featuring a golden square dial and link bracelet set with warm amber lucite panels.',
    color: ['Gold', 'Amber'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '6': {
    title: 'Vintage Stainless Steel Link Watch with Two-Tone Dial',
    category: 'Watches',
    subCategory: 'Vintage Watches',
    brand: 'Classic Vintage',
    description: 'Retro stainless steel link bracelet wristwatch with clean rectangular case and two-tone metallic sunburst dial.',
    color: ['Silver'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '7': {
    title: 'Silver Beaded Charm Bracelet with Celestial Stars',
    category: 'Jewelry',
    subCategory: 'Bracelets',
    brand: 'Artisan Silver',
    description: 'Dainty silver beaded bracelet accented with miniature celestial star charms and polished round spacer beads.',
    color: ['Silver'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '8': {
    title: 'Gold Oval Link Chain Necklace with Woven Pearl Accents',
    category: 'Jewelry',
    subCategory: 'Necklaces',
    brand: 'Artisan Jewelry',
    description: 'Lustrous gold oval link chain necklace artistically interwoven with luminous white faux pearls.',
    color: ['Gold', 'White Pearl'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '9': {
    title: 'Oxidized Silver Floral Dome Jhumka Drop Earrings',
    category: 'Jewelry',
    subCategory: 'Earrings',
    brand: 'Traditional Artisan',
    description: 'Traditional Indian oxidized silver jhumka earrings featuring floral stud tops, filigree domes, and playful ghunghroo bells.',
    color: ['Oxidized Silver'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '10': {
    title: 'Tribal Silver Filigree Chandbali Drop Earrings',
    category: 'Jewelry',
    subCategory: 'Earrings',
    brand: 'Tribal Silver',
    description: 'Ethnic tribal silver crescent chandbali drop earrings with intricate wire filigree work and dangling chime beads.',
    color: ['Silver'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '11': {
    title: 'Dainty Solitaire Crystal Pendant Gold Chain Necklace',
    category: 'Jewelry',
    subCategory: 'Necklaces',
    brand: 'Artisan Gold',
    description: 'Fine gold cable chain necklace featuring a bezel-set round brilliant solitaire crystal sparkling pendant.',
    color: ['Gold', 'Crystal'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '12': {
    title: 'Square Emerald Green Gemstone Pendant Gold Necklace',
    category: 'Jewelry',
    subCategory: 'Necklaces',
    brand: 'Artisan Gold',
    description: 'Delicate gold link necklace holding an emerald-cut square emerald green gemstone pendant with prong bezel setting.',
    color: ['Gold', 'Emerald Green'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '13': {
    title: 'Oxidized Silver Detailed Peacock Motif Stud Earrings',
    category: 'Jewelry',
    subCategory: 'Earrings',
    brand: 'Artisan Silver',
    description: 'Finely engraved oxidized silver ethnic stud earrings modeled in the regal motif of feathered peacocks with floral plumage.',
    color: ['Silver'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '14': {
    title: 'Antique Brass Geometric Spike Huggie Hoop Earrings',
    category: 'Jewelry',
    subCategory: 'Earrings',
    brand: 'Boho Tribal',
    description: 'Bold antique bronze/brass huggie hoop earrings detailed with tactile geometric pyramids and pointed fringe spikes.',
    color: ['Bronze', 'Brass'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '15': {
    title: 'Kundan & Mirror Work Floral Statement Adjustable Rings (Pair)',
    category: 'Jewelry',
    subCategory: 'Rings',
    brand: 'Traditional Artisan',
    description: 'A striking pair of circular statement rings with traditional Rajasthani kundan stones surrounding a center mirror medallion.',
    color: ['Gold', 'White Kundan'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  },
  '16': {
    title: 'Tribal Silver Beaded Fringe Choker Necklace with Leaf Charms',
    category: 'Jewelry',
    subCategory: 'Necklaces',
    brand: 'Tribal Artisan',
    description: 'Ethnic handcrafted choker necklace boasting multi-layered silver bead strands, embossed leaf fringe charms, and a spiral focal medallion.',
    color: ['Silver'],
    condition: 'PRISTINE',
    listingType: 'ACCESSORY_SWAP'
  }
};

const RENTAL_UPDATES = {
  '1': {
    title: 'Ivory Chikankari Embroidered Lehenga with Multicolor Kalamkari Dupatta',
    category: 'Lehengas',
    subCategory: 'Lehenga Sets',
    brand: 'Heritage Festive',
    description: 'Breathtaking ivory white georgette lehenga with all-over intricate Chikankari floral needlework, paired with an artisanal multicolor Kalamkari print choli blouse and matching dupatta.',
    color: ['Ivory White', 'Multicolor'],
    condition: 'PRISTINE'
  },
  '2': {
    title: 'Rust Peach Woven Floral Jaal Brocade Silk Saree',
    category: 'Sarees',
    subCategory: 'Brocade Silk Sarees',
    brand: 'Heritage Weaves',
    description: 'Opulent rust peach brocade art silk saree woven with a rich floral jaal pattern across the body and finished with glistening gold zari borders.',
    color: ['Rust Peach', 'Gold'],
    condition: 'PRISTINE'
  },
  '3': {
    title: 'Sky Blue Georgette Saree with Embroidered Floral Border & Blouse',
    category: 'Sarees',
    subCategory: 'Georgette Sarees',
    brand: 'Kaphor Festive',
    description: 'Ethereal sky blue flowy georgette saree accented with resham threadwork, a rich contrast crimson red zari embroidered border, and heavily embellished matching blouse.',
    color: ['Sky Blue', 'Crimson Red'],
    condition: 'PRISTINE'
  },
  '4': {
    title: 'Ombre Coral Pink & Red Bandhani Saree with Gota Patti Border',
    category: 'Sarees',
    subCategory: 'Bandhani Sarees',
    brand: 'Artisan Weaves',
    description: 'Vibrant dual-tone coral pink and crimson red authentic tie-dye Bandhani saree adorned with handcrafted golden Gota Patti floral leaf borders.',
    color: ['Coral Pink', 'Red', 'Gold'],
    condition: 'PRISTINE'
  },
  '5': {
    title: 'Lilac Organza Silk Saree with Paisley Zari Border & Plum Blouse',
    category: 'Sarees',
    subCategory: 'Organza Sarees',
    brand: 'Kaphor Silk',
    description: 'Translucent pastel lilac organza silk saree highlighted by an ornate silver-gold paisley zari scalloped border and paired with a deep plum purple raw silk blouse.',
    color: ['Lilac', 'Plum Purple'],
    condition: 'PRISTINE'
  },
  '6': {
    title: 'Royal Magenta Kanjivaram Silk Saree with Heavy Gold Zari Border',
    category: 'Sarees',
    subCategory: 'Kanjivaram Sarees',
    brand: 'Heritage Kanjivaram',
    description: 'Regal magenta-purple pure Kanjeevaram silk saree boasting majestic gold zari peacock and floral motifs along the wide border and pallu.',
    color: ['Royal Magenta', 'Gold'],
    condition: 'PRISTINE'
  },
  '7': {
    title: 'Peacock Blue Scalloped Floral Embroidered Raw Silk Festive Set',
    category: 'Kurtas',
    subCategory: 'Festive Co-Ords',
    brand: 'Kaphor Festive',
    description: 'Striking peacock teal blue raw silk festive ensemble featuring heavy resham, zari, and pearl bead embroidery with scalloped hemlines and decorative tassels.',
    color: ['Peacock Blue', 'Teal'],
    condition: 'PRISTINE'
  },
  '8': {
    title: 'Charcoal Grey Pleated Georgette Anarkali Suit with Embroidered Dupatta',
    category: 'Anarkalis',
    subCategory: 'Anarkali Sets',
    brand: 'Kaphor Festive',
    description: 'Dramatic slate grey pleated georgette anarkali silhouette with sequin floral neckline embellishments and a coordinating embroidered border dupatta.',
    color: ['Charcoal Grey', 'Slate'],
    condition: 'PRISTINE'
  },
  '9': {
    title: 'Blush Pink Geometric Sequin Embroidered Kurta Sharara Set',
    category: 'Kurtas',
    subCategory: 'Sharara Sets',
    brand: 'Kaphor Festive',
    description: 'Celebratory blush pink georgette kurta sharara set with a heavily embroidered panel kurta exhibiting multicolor geometric motifs and delicate sequin work.',
    color: ['Blush Pink', 'Multicolor'],
    condition: 'PRISTINE'
  },
  '10': {
    title: 'Tangerine Orange Gota Patti Anarkali Suit with Bandhani Dupatta',
    category: 'Anarkalis',
    subCategory: 'Anarkali Sets',
    brand: 'Kaphor Festive',
    description: 'Radiant festive tangerine orange flared anarkali suit decorated with gold gota patti and mirror embroidery, paired with a scarlet bandhani dupatta.',
    color: ['Tangerine Orange', 'Gold', 'Red'],
    condition: 'PRISTINE'
  },
  '11': {
    title: 'Pine Green Raw Silk Straight Kurta Set with Fuchsia Ruffle Dupatta',
    category: 'Kurtas',
    subCategory: 'Straight Kurta Sets',
    brand: 'Kaphor Festive',
    description: 'Deep pine green raw silk straight kurta accented with pink floral threadwork, matching tailored silk cigarette pants, and a vivid fuchsia pink organza ruffle dupatta.',
    color: ['Pine Green', 'Fuchsia Pink'],
    condition: 'PRISTINE'
  },
  '12': {
    title: 'Dusty Blue Silver Embroidered Peplum Kurta & Tiered Sharara Set',
    category: 'Kurtas',
    subCategory: 'Sharara Sets',
    brand: 'Kaphor Festive',
    description: 'Elegant dusty powder blue georgette short peplum kurta lavishly adorned with silver mirror and zari embroidery, accompanied by voluminous tiered pleated sharara pants.',
    color: ['Dusty Blue', 'Silver'],
    condition: 'PRISTINE'
  },
  '13': {
    title: 'Crimson Maroon Tiered Garba Lehenga Choli with Kalamkari Peacock Dupatta',
    category: 'Lehengas',
    subCategory: 'Lehenga Choli',
    brand: 'Kaphor Festive',
    description: 'Festive crimson maroon pure cotton tiered lehenga choli edged with glistening gold gota laces, accompanied by a vibrant multicolor peacock Kalamkari print dupatta.',
    color: ['Maroon', 'Multicolor', 'Gold'],
    condition: 'PRISTINE'
  },
  'm1': {
    title: "Dhawal Men's Turquoise Raw Silk Kurta with Embroidered Placket",
    category: 'Kurtas',
    subCategory: "Men's Ethnic",
    brand: 'Dhawal',
    description: "Men's tailored turquoise blue raw silk kurta featuring an intricately hand-embroidered mandarin collar, deep V-placket, and cuff embellishments.",
    color: ['Turquoise', 'Cyan'],
    condition: 'PRISTINE'
  }
};

async function main() {
  console.log('🚀 Starting catalog alignment...');

  const allGarments = await prisma.garment.findMany({
    select: { id: true, images: true, title: true }
  });

  const getImgKey = (url, folder) => {
    const match = url.match(new RegExp(`${folder}/(\\d+|m1)\\.jpe?g`));
    return match ? match[1] : null;
  };

  // 1. Update Thrift items
  for (const g of allGarments) {
    const img = (g.images && g.images[0]) || '';
    const key = getImgKey(img, 'thrift');
    if (key && THRIFT_UPDATES[key]) {
      const u = THRIFT_UPDATES[key];
      await prisma.garment.update({
        where: { id: g.id },
        data: {
          title: u.title,
          category: u.category,
          subCategory: u.subCategory,
          brand: u.brand,
          description: u.description,
          color: u.color,
          fabric: u.fabric,
          style: u.style,
          condition: u.condition,
          listingType: u.listingType,
          isActive: true,
          lifecycleState: 'LISTED'
        }
      });
      console.log(`✅ Updated Thrift #${key}: "${u.title}" (${u.category})`);
    }
  }

  // 2. Update Swap items
  for (const g of allGarments) {
    const img = (g.images && g.images[0]) || '';
    const key = getImgKey(img, 'swaps');
    if (key && SWAP_UPDATES[key]) {
      const u = SWAP_UPDATES[key];
      await prisma.garment.update({
        where: { id: g.id },
        data: {
          title: u.title,
          category: u.category,
          subCategory: u.subCategory,
          brand: u.brand,
          description: u.description,
          color: u.color,
          condition: u.condition,
          listingType: u.listingType,
          isActive: true,
          lifecycleState: 'LISTED'
        }
      });
      console.log(`✅ Updated Swap #${key}: "${u.title}" (${u.category})`);
    }
  }

  // 3. Update Rental items
  for (const g of allGarments) {
    const img = (g.images && g.images[0]) || '';
    const key = getImgKey(img, 'rentals');
    if (key && RENTAL_UPDATES[key]) {
      const u = RENTAL_UPDATES[key];
      await prisma.garment.update({
        where: { id: g.id },
        data: {
          title: u.title,
          category: u.category,
          subCategory: u.subCategory,
          brand: u.brand,
          description: u.description,
          color: u.color,
          condition: u.condition,
          isActive: true,
          lifecycleState: 'LISTED'
        }
      });
      console.log(`✅ Updated Rental #${key}: "${u.title}" (${u.category})`);
    }
  }

  // 4. Specifically fix the Vintage Embroidered Denim Jacket listing (the user's upload)
  // ID: a5c7aa31-987b-4bde-b069-5070a4c81ebc
  const userJacketImage = 'https://res.cloudinary.com/bcwibvye/image/upload/f_auto,q_auto/v1789628443/kaphor/garments/80dcea42-a530-48d5-a18d-18c91ca3c0fc-1789628442553.jpg';
  
  await prisma.garment.update({
    where: { id: 'a5c7aa31-987b-4bde-b069-5070a4c81ebc' },
    data: {
      title: 'Vintage Embroidered Belted Denim Jacket',
      description: 'Chambray blue washed denim kurti jacket adorned with rich crimson red floral threadwork embroidery along the split V-neckline, sleeves, and hemline.',
      category: 'Jackets',
      subCategory: 'Denim Jackets',
      brand: 'Vintage',
      fabric: 'Denim Chambray',
      style: 'Ethnic Fusion / Vintage',
      color: ['Blue', 'Red'],
      images: [userJacketImage],
      isActive: true,
      lifecycleState: 'LISTED',
      price: 350
    }
  });
  console.log('✅ Fixed user Denim Jacket listing (a5c7aa31) with real Cloudinary image and isActive: true!');

  // 5. Also ensure the companion listing a4d42980 is active and properly titled
  await prisma.garment.update({
    where: { id: 'a4d42980-3f8f-433a-8bf4-5e8d124b8d63' },
    data: {
      title: 'Vintage Red Embroidered Denim Kurti Jacket',
      category: 'Jackets',
      subCategory: 'Denim Jackets',
      brand: 'Vintage',
      images: [userJacketImage],
      isActive: true,
      lifecycleState: 'LISTED'
    }
  });
  console.log('✅ Fixed companion listing (a4d42980) with isActive: true!');

  // 6. Fix the "Earring" necklace listing e08cf4a9
  const swap11Url = 'https://res.cloudinary.com/bcwibvye/image/upload/f_auto,q_auto/v1789537446/kaphor/swaps/11.jpg';
  await prisma.garment.update({
    where: { id: 'e08cf4a9-6175-4cfd-9b42-f28fcad82fb8' },
    data: {
      title: 'Dainty Solitaire Crystal Pendant Gold Necklace',
      description: 'Fine gold cable chain necklace featuring a bezel-set round brilliant solitaire crystal pendant.',
      category: 'Jewelry',
      subCategory: 'Necklaces',
      brand: 'Artisan Gold',
      color: ['Gold', 'Crystal'],
      images: [swap11Url],
      listingType: 'ACCESSORY_SWAP',
      isActive: true,
      lifecycleState: 'LISTED'
    }
  });
  console.log('✅ Fixed Earring listing (e08cf4a9) to accurate Solitaire Pendant Necklace with Cloudinary image!');

  // 7. Ensure Swap 3 (Polished Silver Chunky Hinged Bangle Bracelet) exists as an active swap
  const swap3Url = 'https://res.cloudinary.com/bcwibvye/image/upload/f_auto,q_auto/v1789537426/kaphor/swaps/3.jpg';
  const existingSwap3 = await prisma.garment.findFirst({
    where: { images: { has: swap3Url } }
  });

  if (!existingSwap3) {
    // Get an existing seller id
    const sample = await prisma.garment.findFirst({ select: { sellerId: true } });
    if (sample) {
      await prisma.garment.create({
        data: {
          sellerId: sample.sellerId,
          title: 'Polished Silver Chunky Hinged Bangle Bracelet',
          description: 'Sleek high-polish silver chunky cuff bangle with a secure concealed hinge mechanism and modern minimalist silhouette.',
          category: 'Jewelry',
          subCategory: 'Bracelets',
          brand: 'Artisan Silver',
          size: 'FREE SIZE',
          color: ['Silver'],
          material: ['Silver'],
          condition: 'PRISTINE',
          images: [swap3Url],
          listingType: 'ACCESSORY_SWAP',
          isActive: true,
          lifecycleState: 'LISTED'
        }
      });
      console.log('✅ Created dedicated active Swap item for Swap #3!');
    }
  } else {
    await prisma.garment.update({
      where: { id: existingSwap3.id },
      data: {
        title: 'Polished Silver Chunky Hinged Bangle Bracelet',
        category: 'Jewelry',
        subCategory: 'Bracelets',
        listingType: 'ACCESSORY_SWAP',
        isActive: true,
        lifecycleState: 'LISTED'
      }
    });
    console.log('✅ Updated existing Swap #3 item!');
  }

  // 8. Ensure Sage Green top (5676998e) is active
  await prisma.garment.update({
    where: { id: '5676998e-4ea6-4edc-83be-7a0e8d1c0e22' },
    data: {
      isActive: true,
      lifecycleState: 'LISTED'
    }
  });
  console.log('✅ Activated Sage Green Ribbed Top (5676998e)!');

  console.log('\n🎉 ALL LISTINGS SYNCHRONIZED AND REALISTICALLY NAMED!');
}

main()
  .catch(e => {
    console.error('Error executing catalog update:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
