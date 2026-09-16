const fs = require('fs');
const path = require('path');

const t5Path = path.resolve(__dirname, '../data/T5.json');
const rawData = JSON.parse(fs.readFileSync(t5Path, 'utf-8'));

console.log(`Loaded ${rawData.length} guides from ${t5Path}`);

function cleanTitle(title, fiber, category, damage, technique) {
  const f = (Array.isArray(fiber) ? fiber[0] : fiber) || 'Garment';
  const c = (Array.isArray(category) ? category[0] : category) || 'Piece';
  const d = (Array.isArray(damage) ? damage[0] : damage) || 'damage';
  const t = (Array.isArray(technique) ? technique[0] : technique) || 'repair';

  const techMap = {
    plain_repair: 'Hand Mending & Invisible Weave',
    embroidery: 'Silk Embroidery Restoration',
    block_print: 'Block Print Re-Stamping & Pigment Touchup',
    zari: 'Metallic Zari Thread Couching',
    patchwork: 'Structural Patchwork & Sashiko',
    kantha: 'Kantha Running-Stitch Reinforcement',
  };

  const damageMap = {
    tear: 'Tear Mending & Border Realignment',
    embroidery_damage: 'Embroidery Thread Lock & Re-stitching',
    fading: 'Sun Fading Restoration & Color Refresh',
    fraying: 'Frayed Edge Binding & Overcast Seam',
    stain: 'Targeted Stain Concealment & Spot Treatment',
    hole: 'Hole Reinforcement & Darning',
    missing_button: 'Loop Reconstruction & Button Anchor',
    pilling: 'Surface De-pilling & Fiber Conditioning',
    broken_zip: 'Zipper Slider Realignment & Stop Reset',
  };

  const cleanTech = techMap[t] || 'Artisan Restoration';
  const cleanDmg = damageMap[d] || 'Fabric Repair';

  // Capitalize category properly
  const catCapital = c.charAt(0).toUpperCase() + c.slice(1);
  return `${f} ${catCapital}: ${cleanDmg}`;
}

function cleanTechniqueStyle(tech) {
  const t = Array.isArray(tech) ? tech[0] : tech;
  const map = {
    plain_repair: 'Invisible Hand Mending',
    embroidery: 'Embroidery Thread Restoration',
    block_print: 'Artisan Block Printing',
    zari: 'Zari Metallic Couching',
    patchwork: 'Sashiko & Fabric Patchwork',
    kantha: 'Traditional Kantha Reinforcement',
    upcycling: 'Circular Haute Upcycling',
  };
  return map[t] || 'Artisan Technique';
}

function extractSections(fullText) {
  if (!fullText) return {};
  const sections = {};
  const matches = fullText.split(/###\s*SECTION\s*\d+:\s*/i);
  for (const m of matches) {
    if (!m.trim()) continue;
    const lines = m.trim().split('\n');
    const header = lines[0].trim().toUpperCase();
    const body = lines.slice(1).join('\n').trim();
    sections[header] = body;
  }
  return sections;
}

const UPGRADE_UPCYCLE_DOCS = [
  {
    doc_id: 't5-051',
    doc_type: 'upcycle',
    title: 'Vintage Silk Saree Pallu to Royal Embroidered Potli Bag',
    fiber_types: ['Mulberry Silk', 'Banarasi Silk'],
    damage_types: ['tear', 'hole', 'upcycling'],
    garment_categories: ['saree', 'lehenga'],
    damage_location: ['body', 'pallu'],
    difficulty: 'intermediate',
    time_minutes: 60,
    technique_style: ['upcycling'],
    quality_score: 0.98,
    tools_required: ['fine fabric scissors', 'drawstring silk cord', 'metallic zari tassel beads', 'sewing needle', 'fusible cotton lining'],
    steps: [
      {
        step: 1,
        instruction: 'Inspect the saree to isolate the unblemished, heavily ornamented pallu section. Cut two matching 22x26 cm rectangular panels using fabric scissors.',
        tip: 'Leave a 1.5 cm seam allowance around the decorative motifs.'
      },
      {
        step: 2,
        instruction: 'Fuse lightweight cotton stabilizer backing to the reverse of both silk panels with a warm dry iron to add body and prevent drape collapse.',
        tip: 'Never apply direct heat to gold zari or delicate silk; use a pressing cloth.'
      },
      {
        step: 3,
        instruction: 'Place the two embellished panels right sides facing and stitch along the sides and bottom curved base, stopping 5 cm from the top opening.',
        tip: 'Reinforce the curved bottom corner with double stitching for structural durability.'
      },
      {
        step: 4,
        instruction: 'Fold the top opening 2 cm inward to form a tunnel channel for the drawstring and topstitch cleanly along the edge.',
        tip: 'Ensure the channel opening is smooth and clear of raw frayed thread tails.'
      },
      {
        step: 5,
        instruction: 'Thread a metallic braided silk drawstring through both channels using a safety pin, and knot handmade zari latkan tassels at each cord end.',
        tip: 'Steam lightly from the inside to reveal the pouch shape.'
      }
    ],
    pro_tip: 'Using the pallu border creates instant luxury symmetry without needing additional decorative lace.',
    care_instructions: 'Dry clean only or gentle spot clean with mild silk wash. Store packed with tissue paper to hold its shape.',
    upcycle_alternative: 'If fabric remains, create matching coin purses or pocket squares from leftover scraps.'
  },
  {
    doc_id: 't5-052',
    doc_type: 'upcycle',
    title: 'Heritage Saree Border to Decorative Silk Cushion Covers',
    fiber_types: ['Kanjivaram Silk', 'Chanderi'],
    damage_types: ['stain', 'tear', 'upcycling'],
    garment_categories: ['saree'],
    damage_location: ['overall'],
    difficulty: 'beginner',
    time_minutes: 45,
    technique_style: ['patchwork'],
    quality_score: 0.96,
    tools_required: ['cutting mat', 'rotary cutter', 'heavy sewing thread', 'cushion zipper', 'linen backing fabric'],
    steps: [
      {
        step: 1,
        instruction: 'Salvage the intact zari border strips from the damaged saree length, cutting them into four 40 cm long segments.',
        tip: 'Press the borders flat with steam under a damp cloth before cutting.'
      },
      {
        step: 2,
        instruction: 'Arrange the borders in a framing grid over a 42x42 cm square piece of neutral raw silk or linen backing fabric.',
        tip: 'Pin securely every 4 cm to prevent silk slippage during machine feeding.'
      },
      {
        step: 3,
        instruction: 'Topstitch along both edges of each border strip using a fine edge-stitch foot and color-matched thread.',
        tip: 'Stitch in the same direction on all parallel strips to avoid diagonal twisting.'
      },
      {
        step: 4,
        instruction: 'Attach an invisible zipper along the bottom seam of the back linen panel, then join front and back right sides together.',
        tip: 'Leave the zipper halfway open before sewing perimeter seams so you can turn the cover right side out.'
      },
      {
        step: 5,
        instruction: 'Clip corner seam allowances, turn right-side out, press with a press cloth, and insert a 40x40 cm down feather or cotton filler.',
        tip: 'Crisp corner points can be poked gently with a blunt wooden chopstick.'
      }
    ],
    pro_tip: 'Heritage Banarasi and Kanjivaram borders have high resale appeal when repurposed into luxury interior decor.',
    care_instructions: 'Dry clean only to protect metallic zari weft from oxidizing.',
    upcycle_alternative: 'Narrower border offcuts can be stitched into bespoke luggage tags or book bookmarks.'
  },
  {
    doc_id: 't5-053',
    doc_type: 'upcycle',
    title: 'Torn Men\'s Silk Kurta to Structured Nehru Waistcoat (Koti)',
    fiber_types: ['Standard Cotton', 'Mulberry Silk', 'Khadi'],
    damage_types: ['tear', 'stain', 'upcycling'],
    garment_categories: ['kurta'],
    damage_location: ['armpit', 'sleeve'],
    difficulty: 'advanced',
    time_minutes: 90,
    technique_style: ['upcycling'],
    quality_score: 0.97,
    tools_required: ['fabric shears', 'tailor\'s chalk', 'woven fusible interfacing', 'mandarin collar pattern', 'brass/horn buttons'],
    steps: [
      {
        step: 1,
        instruction: 'Carefully remove both damaged sleeves at the shoulder armhole seam using a seam ripper, preserving the clean front and back body torso.',
        tip: 'Avoid tearing into the front chest placket.'
      },
      {
        step: 2,
        instruction: 'Trim the kurta length to hip level (65-70 cm from shoulder) to establish modern Nehru jacket proportions.',
        tip: 'Mark a straight horizontal reference line with tailor\'s chalk and ruler before cutting.'
      },
      {
        step: 3,
        instruction: 'Apply medium-weight canvas interfacing to the front chest panels and mandarin collar to give the lightweight kurta structured tailored drape.',
        tip: 'Use firm, even iron pressure for 12 seconds per section to bond the interfacing.'
      },
      {
        step: 4,
        instruction: 'Re-bind the armhole perimeters with clean 2.5 cm bias binding cut from intact lower kurta fabric scraps.',
        tip: 'Press the binding inward and hand-stitch with invisible slip stitches.'
      },
      {
        step: 5,
        instruction: 'Replace standard plastic buttons with antiqued brass or natural horn buttons along the central placket.',
        tip: 'Sew buttons with a thread shank underneath to allow comfortable fastening over shirts.'
      }
    ],
    pro_tip: 'Eliminating torn sleeves breathes a second lifecycle into formal ethnic menswear with zero visible damage.',
    care_instructions: 'Hand wash in cold water or dry clean depending on base silk/cotton fiber composition.',
    upcycle_alternative: 'Sleeve fabric scraps can be used to construct a matching pocket square.'
  },
  {
    doc_id: 't5-054',
    doc_type: 'upcycle',
    title: 'Distressed Raw Denim Jeans to High-Fashion Patchwork Tote',
    fiber_types: ['Standard Cotton'],
    damage_types: ['hole', 'fraying', 'upcycling'],
    garment_categories: ['jeans'],
    damage_location: ['knee', 'crotch'],
    difficulty: 'intermediate',
    time_minutes: 75,
    technique_style: ['patchwork'],
    quality_score: 0.95,
    tools_required: ['heavy-duty denim needle size 100/16', 'jeans thread 40wt', 'fabric scissors', 'cotton webbing straps', 'heavy iron'],
    steps: [
      {
        step: 1,
        instruction: 'Deconstruct worn denim jeans along outer seams and back pockets. Cut into uniform 15x15 cm patches, grouping dark indigo, faded, and distressed panels.',
        tip: 'Preserve authentic back pockets intact to serve as exterior phone slots on the finished tote.'
      },
      {
        step: 2,
        instruction: 'Piece the patches into two 45x42 cm patchwork grids (3 across by 3 down) using flat-felled or reinforced straight seams.',
        tip: 'Press all seam allowances open with high steam and a clapper to eliminate bulk.'
      },
      {
        step: 3,
        instruction: 'Stitch visible Sashiko geometric running stitches across fraying areas using thick white or ecru thread to celebrate the patina.',
        tip: 'Maintain even 4 mm stitch spacing across reinforced sections.'
      },
      {
        step: 4,
        instruction: 'Join the front and back panels along the sides and base. Box the bottom corners by 6 cm to give the tote depth and freestanding structure.',
        tip: 'Reinforce the stress corners with double bar-tacks.'
      },
      {
        step: 5,
        instruction: 'Attach 60 cm heavy cotton webbing handles to the interior upper hem, topstitching with a reinforced box-and-cross stitch pattern.',
        tip: 'Ensure handles are centered 12 cm apart on both sides for balanced carry.'
      }
    ],
    pro_tip: 'Heavy 12-14oz denim makes an indestructible shopping and laptop tote that patinas even better over time.',
    care_instructions: 'Machine wash inside out in cold water. Air dry to maintain indigo depth.',
    upcycle_alternative: 'Very small denim scraps make great cup coasters or insulated hot pads.'
  },
  {
    doc_id: 't5-055',
    doc_type: 'repair',
    title: 'Cashmere & Fine Wool Sweater Moth Hole Swiss Darning',
    fiber_types: ['Wool / Cashmere'],
    damage_types: ['hole'],
    garment_categories: ['sweater', 'other'],
    damage_location: ['overall', 'body'],
    difficulty: 'intermediate',
    time_minutes: 45,
    technique_style: ['plain_repair'],
    quality_score: 0.98,
    tools_required: ['darning mushroom or egg', 'tapestry needle size 22', 'color-matched 2-ply cashmere yarn', 'magnifying lamp', 'steam iron'],
    steps: [
      {
        step: 1,
        instruction: 'Position the darning mushroom underneath the moth hole to support the knit stitches without overstretching the surrounding wool gauge.',
        tip: 'Use gentle tension so the opening stays natural and unstrained.'
      },
      {
        step: 2,
        instruction: 'Catch all live unraveled knit loops above and below the hole with tiny safety pins or contrasting thread so the hole does not run further.',
        tip: 'Inspect closely under good lighting to catch every dropped loop.'
      },
      {
        step: 3,
        instruction: 'Create horizontal foundation bridge threads across the gap with your tapestry needle, anchoring into solid knit fabric 1 cm on either side.',
        tip: 'Do not pull tight; match the natural elasticity of the sweater knit.'
      },
      {
        step: 4,
        instruction: 'Execute Swiss darning (duplicate stitch), tracing the needle through each foundation loop to recreate the original "V" knit pattern identically.',
        tip: 'Work row by row, mirroring the exact gauge of the sweater yarn.'
      },
      {
        step: 5,
        instruction: 'Weave yarn tails into the back of the knit for 2 cm and hover steam the repair from 1 inch away to allow the wool fibers to bloom and meld together.',
        tip: 'Never press the iron directly onto cashmere; steam lets the halo fibers blend invisibly.'
      }
    ],
    pro_tip: 'Swiss darning preserves the stretch and flexibility of knitwear, unlike fabric patches which cause puckering.',
    care_instructions: 'Hand wash in lukewarm water with wool detergent. Dry flat on a towel; store with cedar blocks to repel moths.',
    upcycle_alternative: 'If multiple holes exist across sleeves, convert into a cropped sleeveless sweater vest.'
  },
  {
    doc_id: 't5-056',
    doc_type: 'dye_guide',
    title: 'Stained Silk Blouse Natural Botanical Overdyeing',
    fiber_types: ['Mulberry Silk'],
    damage_types: ['stain', 'fading'],
    garment_categories: ['blouse', 'top'],
    damage_location: ['overall', 'armpit'],
    difficulty: 'intermediate',
    time_minutes: 60,
    technique_style: ['block_print'],
    quality_score: 0.94,
    tools_required: ['stainless steel dye pot', 'natural indigo or madder dye pigment', 'alum mordant', 'wooden stirring paddle', 'rubber gloves'],
    steps: [
      {
        step: 1,
        instruction: 'Scour the stained silk blouse in warm water with gentle pH-neutral soap to remove surface oils and sizing.',
        tip: 'Do not wring or twist delicate silk fabric.'
      },
      {
        step: 2,
        instruction: 'Pre-mordant the wet blouse in a 10% alum solution at 60°C for 30 minutes to prepare the silk fibers to bond permanently with dye.',
        tip: 'Allow the bath to cool naturally before lifting the garment.'
      },
      {
        step: 3,
        instruction: 'Prepare the dye vat with concentrated natural indigo, madder root, or iron extract, straining out all sediment particles.',
        tip: 'Dyeing to a richer shade (e.g. deep charcoal, midnight navy, or burgundy) completely masks stains.'
      },
      {
        step: 4,
        instruction: 'Submerge the blouse evenly into the dye bath, stirring slowly and continuously for 25 minutes to prevent streaks.',
        tip: 'Keep the garment moving under the liquid surface to avoid uneven oxidation.'
      },
      {
        step: 5,
        instruction: 'Rinse in cold running water until the runoff is clear, then air dry completely in the shade.',
        tip: 'Press on reverse side while slightly damp for brilliant silk luster.'
      }
    ],
    pro_tip: 'Natural overdyeing transforms an unsellable stained luxury blouse into an exclusive artisanal designer piece.',
    care_instructions: 'Wash separately in cold water with mild silk detergent for the first 3 washes. Dry in shade.',
    upcycle_alternative: 'Use shibori resist-folding before dyeing to create intentional cloud patterns over stubborn spots.'
  },
  {
    doc_id: 't5-057',
    doc_type: 'upcycle',
    title: 'Frayed Formal Cotton Shirt to Mandarin Collar Sleeveless Tunic',
    fiber_types: ['Standard Cotton', 'Linen'],
    damage_types: ['fraying'],
    garment_categories: ['shirt'],
    damage_location: ['collar', 'cuff'],
    difficulty: 'beginner',
    time_minutes: 40,
    technique_style: ['upcycling'],
    quality_score: 0.95,
    tools_required: ['fine seam ripper', 'tailor\'s shears', 'sewing machine', 'cotton bias tape', 'steam iron'],
    steps: [
      {
        step: 1,
        instruction: 'Slice off the frayed collar points cleanly along the collar stand seam, converting the shirt to a clean band / Mandarin collar.',
        tip: 'Leave a 6 mm seam allowance to fold inward.'
      },
      {
        step: 2,
        instruction: 'Fold the raw edge of the collar stand inward and edgestitch neatly with matching thread 1 mm from the fold.',
        tip: 'Press with high steam to create a sharp, flat band.'
      },
      {
        step: 3,
        instruction: 'Remove the frayed sleeve cuffs and shorten sleeves to short sleeve or sleeveless armhole silhouette.',
        tip: 'Ensure both sleeves are measured and trimmed to identical lengths.'
      },
      {
        step: 4,
        instruction: 'Finish the sleeve hems with a clean 1.5 cm double fold hem and press.',
        tip: 'Pin well around armhole curves to prevent ripples.'
      },
      {
        step: 5,
        instruction: 'Give the entire shirt a final crisp press with sizing spray for a clean summer resort look.',
        tip: 'Inspect placket alignment to ensure buttons fasten symmetrically.'
      }
    ],
    pro_tip: 'Collar and cuff fraying is the #1 reason men\'s luxury dress shirts are discarded; removing them yields an elegant leisure tunic.',
    care_instructions: 'Machine wash warm, tumble dry low or line dry, and steam press.',
    upcycle_alternative: 'Cut-off cuffs can be repurposed into fabric cord organizers.'
  },
  {
    doc_id: 't5-058',
    doc_type: 'repair',
    title: 'Luxury Leather Handbag Edge Glazing & Conditioning',
    fiber_types: ['Leather / Suede'],
    damage_types: ['fraying', 'wear_zone'],
    garment_categories: ['accessory', 'other'],
    damage_location: ['strap', 'edge'],
    difficulty: 'intermediate',
    time_minutes: 50,
    technique_style: ['plain_repair'],
    quality_score: 0.97,
    tools_required: ['fine sandpaper 600 & 1000 grit', 'matte leather edge paint', 'roller edge applicator', 'beeswax block', 'leather conditioner'],
    steps: [
      {
        step: 1,
        instruction: 'Clean the scuffed leather edge with a damp microfiber cloth to remove oils, dust, and peeling old glaze.',
        tip: 'Do not saturate the leather with excessive moisture.'
      },
      {
        step: 2,
        instruction: 'Sand the raw strap edge gently in one direction with 600 grit sandpaper until smooth and uniform.',
        tip: 'Avoid scratching the finished face of the leather.'
      },
      {
        step: 3,
        instruction: 'Apply a thin, even coat of color-matched leather edge paint using the roller applicator pen.',
        tip: 'Two thin coats are significantly more durable than one thick coat.'
      },
      {
        step: 4,
        instruction: 'Allow to dry for 30 minutes, then buff lightly with 1000 grit sandpaper and apply a second topcoat.',
        tip: 'Ensure room is dust-free during drying.'
      },
      {
        step: 5,
        instruction: 'Once dry, rub beeswax along the edge with a canvas cloth to seal against humidity, and apply luxury leather conditioner over the entire bag.',
        tip: 'Buff with a horsehair brush to restore deep luster.'
      }
    ],
    pro_tip: 'Restoring cracked edge paint on luxury designer bags can increase resale value by up to 40%.',
    care_instructions: 'Store in breathable dust bag with shape stuffing. Condition every 6 months.',
    upcycle_alternative: 'If leather is too worn, cut panels into luxury cardholders or key fobs.'
  },
  {
    doc_id: 't5-059',
    doc_type: 'repair',
    title: 'Concealed Zipper Slider Realignment & Stop Reset for Gowns',
    fiber_types: ['Georgette', 'Polyester', 'Mulberry Silk'],
    damage_types: ['broken_zip'],
    garment_categories: ['dress', 'lehenga', 'anarkali'],
    damage_location: ['zipper'],
    difficulty: 'beginner',
    time_minutes: 30,
    technique_style: ['plain_repair'],
    quality_score: 0.95,
    tools_required: ['needle-nose mini pliers', 'replacement invisible slider #3', 'fork slider jig', 'top zipper stops', 'sewing needle & thread'],
    steps: [
      {
        step: 1,
        instruction: 'Inspect the zipper teeth closely. If the teeth are intact but the slider split open or slipped off track, do not replace the entire zipper.',
        tip: 'Replacing just the slider saves hours of delicate seam unpicking.'
      },
      {
        step: 2,
        instruction: 'Remove the metal top stop on the side of the zipper with needle-nose pliers by gently prying the prongs open.',
        tip: 'Save the stop or prepare a new replacement stop.'
      },
      {
        step: 3,
        instruction: 'Slide the existing or new matching #3 invisible zipper slider onto both tape tracks simultaneously at a 45-degree angle.',
        tip: 'Holding the tracks aligned with tweezers ensures the teeth interlock evenly.'
      },
      {
        step: 4,
        instruction: 'Pull the slider down gently to verify that teeth mesh perfectly without gaps or misalignment.',
        tip: 'If teeth bunch, back the slider out and re-enter with equal track tension.'
      },
      {
        step: 5,
        instruction: 'Crimp a new metal zipper stop securely at the top of the track, and reinforce the bottom end with 6 hand whipstitches across the teeth.',
        tip: 'Whipstitches act as an invisible safety stop preventing future slider slip-off.'
      }
    ],
    pro_tip: '90% of "broken zippers" on high-end dresses only have a worn-out slider, not damaged teeth.',
    care_instructions: 'Always close zippers before washing or dry cleaning to avoid catching on delicate fabrics.',
    upcycle_alternative: 'If teeth are missing, convert the opening to a classic loop-and-button closure.'
  },
  {
    doc_id: 't5-060',
    doc_type: 'upcycle',
    title: 'Distressed Silk Chiffon Dupatta to Hand-Rolled Pocket Squares',
    fiber_types: ['Chiffon', 'Mulberry Silk'],
    damage_types: ['tear', 'fraying', 'upcycling'],
    garment_categories: ['saree', 'other'],
    damage_location: ['body'],
    difficulty: 'beginner',
    time_minutes: 40,
    technique_style: ['upcycling'],
    quality_score: 0.94,
    tools_required: ['fine sharp sewing needle size 9', 'silk sewing thread', 'fabric ruler', 'rotary cutter', 'spray starch'],
    steps: [
      {
        step: 1,
        instruction: 'Identify unblemished printed or sheer sections of the damaged dupatta and cut into 33x33 cm squares with a rotary cutter.',
        tip: 'Mist lightly with spray starch to stabilize the slippery chiffon during cutting.'
      },
      {
        step: 2,
        instruction: 'Dampen your thumb and forefinger and roll the raw fabric edge tightly toward the wrong side by 2 mm.',
        tip: 'Practice the roll on a scrap piece until you achieve a tight, rounded cord.'
      },
      {
        step: 3,
        instruction: 'Stitch through the roll using a fine needle, picking up only 1-2 threads of the main fabric and catching the back of the roll every 4 mm.',
        tip: 'Work from right to left with consistent light tension.'
      },
      {
        step: 4,
        instruction: 'Mitre the four corners cleanly by tucking the raw corner point inside the roll before continuing down the next edge.',
        tip: 'Sharp corners define a luxury hand-rolled finish.'
      },
      {
        step: 5,
        instruction: 'Steam press the finished pocket square gently, taking care not to flatten the rounded hand-rolled edge completely.',
        tip: 'The puffed edge is the hallmark of bespoke Italian and French pocket squares.'
      }
    ],
    pro_tip: 'One damaged printed silk dupatta yields 4 to 6 luxury designer pocket squares that sell for high margins.',
    care_instructions: 'Dry clean or gentle cold hand wash. Press on low silk setting.',
    upcycle_alternative: 'Smaller remaining scraps make chic silk hair scrunchies.'
  },
  {
    doc_id: 't5-061',
    doc_type: 'upcycle',
    title: 'Heavily Embroidered Saree Pallu to Framed Textile Art Tapestry',
    fiber_types: ['Banarasi Silk', 'Kanjivaram Silk'],
    damage_types: ['tear', 'stain', 'upcycling'],
    garment_categories: ['saree'],
    damage_location: ['overall'],
    difficulty: 'beginner',
    time_minutes: 45,
    technique_style: ['upcycling'],
    quality_score: 0.96,
    tools_required: ['acid-free foam core board', 'cotton archival mounting tape', 'fabric shears', 'deep shadowbox frame', 'steam iron'],
    steps: [
      {
        step: 1,
        instruction: 'Cut out the most pristine, intricate central medallion or zari motif from the damaged heirloom saree with a 4 cm border margin.',
        tip: 'Preserve antique metallic threads from contact with acidic paper or wood.'
      },
      {
        step: 2,
        instruction: 'Press the textile flat from the reverse side using low heat and a dry pressing cloth.',
        tip: 'Do not use water spray on antique zari, as moisture can cause oxidation.'
      },
      {
        step: 3,
        instruction: 'Wrap the fabric smoothly over an acid-free foam mounting board, pulling gentle equal tension from all four sides.',
        tip: 'Secure on the back using archival textile mounting pins or acid-free tape.'
      },
      {
        step: 4,
        instruction: 'Mount into a UV-protective deep shadowbox frame with a 5 mm spacer so the glass does not touch the raised metallic embroidery.',
        tip: 'Direct contact with glass causes condensation and fiber rot over time.'
      },
      {
        step: 5,
        instruction: 'Seal the back of the frame with brown backing tape to keep out dust and humidity, and install heavy-duty hanging hardware.',
        tip: 'Display away from direct sun exposure to prevent color fading.'
      }
    ],
    pro_tip: 'Transforms sentimental damaged heirlooms that can no longer be worn into museum-quality home focal points.',
    care_instructions: 'Dust frame glass with a microfiber cloth. Display out of direct sunlight.',
    upcycle_alternative: 'Unframed fragments can be sewn into book jackets or luxury stationery covers.'
  },
  {
    doc_id: 't5-062',
    doc_type: 'upcycle',
    title: 'Unraveled Banarasi Brocade to Quilted Evening Clutch',
    fiber_types: ['Banarasi Silk'],
    damage_types: ['fraying', 'upcycling'],
    garment_categories: ['saree', 'lehenga'],
    damage_location: ['hem'],
    difficulty: 'intermediate',
    time_minutes: 70,
    technique_style: ['upcycling'],
    quality_score: 0.97,
    tools_required: ['metal clutch frame with kiss lock', 'heavy-duty fabric glue', 'fusible fleece batting', 'sewing machine', 'craft clips'],
    steps: [
      {
        step: 1,
        instruction: 'Cut two 24x18 cm panels of decorative brocade fabric, carefully centering the jacquard or zari floral pattern.',
        tip: 'Add a layer of lightweight iron-on interfacing to stabilize the brocade edges from unweaving.'
      },
      {
        step: 2,
        instruction: 'Fuse 3 mm fleece batting between the exterior brocade and matching satin lining to give the clutch a plush, padded feel.',
        tip: 'Quilt subtle diagonal guide lines through the layers if desired.'
      },
      {
        step: 3,
        instruction: 'Stitch the exterior pouch and lining along bottom and sides, leaving the top curved frame perimeter open.',
        tip: 'Box the bottom corners by 3 cm so the clutch stands upright.'
      },
      {
        step: 4,
        instruction: 'Apply specialized metal-to-fabric glue inside the channel of the kiss-lock metal clutch frame.',
        tip: 'Work cleanly with a toothpick to prevent glue from smearing onto the silk.'
      },
      {
        step: 5,
        instruction: 'Ease the quilted fabric edge into the frame channel using a flat-head screwdriver or bone folder, and clamp with craft clips for 4 hours.',
        tip: 'Protect the metal frame finish with scrap cloth under the clamp jaws.'
      }
    ],
    pro_tip: 'Brocade evening clutches make coveted luxury accessories and sell for premium circular designer prices.',
    care_instructions: 'Store in a soft dust bag. Spot clean with a dry velvet cloth.',
    upcycle_alternative: 'Leftover scraps make coordinated card sleeves.'
  },
];

const enriched = [];

for (let i = 0; i < rawData.length; i++) {
  const doc = rawData[i];

  if (i >= 50) {
    // Replace non-fashion DIY records with our curated luxury fashion upcycling docs
    const upcycleDoc = UPGRADE_UPCYCLE_DOCS[i - 50];
    if (upcycleDoc) {
      enriched.push(upcycleDoc);
      continue;
    }
  }

  // Docs 1-50: Enrich and transform!
  const fiber = doc.fiber_types?.[0] || 'Silk';
  const category = doc.garment_categories?.[0] || 'saree';
  const damage = doc.damage_types?.[0] || 'tear';
  const rawTech = doc.technique_style?.[0] || 'plain_repair';

  const newTitle = cleanTitle(doc.title, fiber, category, damage, rawTech);
  const cleanTech = cleanTechniqueStyle(rawTech);

  // Extract from full_text
  const sections = extractSections(doc.full_text);
  const prep = sections['PREPARATION STEPS'] || '';
  const repair = sections['REPAIR PROCESS'] || '';
  const finishing = sections['FINISHING'] || '';
  const care = sections['CARE INSTRUCTIONS'] || 'Hand wash in cold water using a mild pH-neutral detergent. Dry flat in shade.';
  const mistakes = sections['COMMON MISTAKES AND UPCYCLE ALTERNATIVES'] || '';

  // Construct concrete, rich, artisan steps
  const steps = [
    {
      step: 1,
      instruction: `Inspect and clean the ${fiber} fabric around the damaged ${doc.damage_location?.[0] || 'area'}. Wash gently with pH-neutral liquid detergent and press over a pressing cloth.`,
      tip: `Never apply direct high heat to delicate ${fiber}; always use a damp pressing cloth.`
    },
    {
      step: 2,
      instruction: `Place the garment on a flat, clean surface and position cardboard underneath to isolate the layer. Apply lightweight water-soluble stabilizer mesh beneath the damaged area.`,
      tip: `Test stabilizer adhesive on a hidden inner seam first to ensure zero discoloration.`
    },
    {
      step: 3,
      instruction: `Anchor your color-matched thread 1 cm away from the damage. Execute ${cleanTech} stitches parallel to the natural warp/weft weave grain.`,
      tip: `Maintain light tension to avoid fabric puckering along decorative borders.`
    },
    {
      step: 4,
      instruction: `Continue stitching across the affected area in neat, parallel passes, extending stitches 1 cm past the damage edge to lock the structure firmly.`,
      tip: `Inspect every 8-10 stitches from the front face under bright natural light to verify pattern alignment.`
    },
    {
      step: 5,
      instruction: `Turn inside out, tie off thread ends with a double knot flush against the backing, trim tails to 2 mm, and press using a warm iron over a dry cloth.`,
      tip: `Steaming relaxes the thread tension into the weave, making the mend virtually invisible.`
    }
  ];

  let proTip = `Avoid overtightening the sewing thread; ${fiber} fibers require relaxed tension to prevent permanent puckering.`;
  if (damage === 'embroidery_damage' || rawTech === 'zari') {
    proTip = `Use fine couching stitches across metallic threads rather than piercing through them to preserve the original shine.`;
  } else if (rawTech === 'block_print') {
    proTip = `Ensure the wooden block is evenly loaded with pigment and press down firmly with your fist without rocking.`;
  }

  let upcycleAlt = `If fabric remains fragile, repurpose the piece into designer cushion covers, an embroidered potli pouch, or table runner.`;
  if (mistakes.includes('potli') || mistakes.includes('cushion')) {
    upcycleAlt = `Consider transforming the undamaged sections into an artisanal potli evening bag, decorative cushion covers, or patchwork runner.`;
  }

  enriched.push({
    doc_id: doc.doc_id,
    doc_type: doc.doc_type || 'repair',
    title: newTitle,
    fiber_types: doc.fiber_types,
    damage_types: doc.damage_types,
    garment_categories: doc.garment_categories,
    damage_location: doc.damage_location,
    difficulty: doc.difficulty || 'beginner',
    time_minutes: doc.time_minutes || 45,
    technique_style: [rawTech],
    quality_score: doc.quality_score || 0.95,
    tools_required: doc.tools_required || [
      'size 70/10 microtex needle',
      'fine silk sewing thread',
      'fabric scissors',
      'steam iron',
      'stabilizer backing'
    ],
    steps: steps,
    pro_tip: proTip,
    care_instructions: care.slice(0, 300).trim(),
    upcycle_alternative: upcycleAlt,
    full_text: doc.full_text,
    source: 'kaphor_artisan_library',
    indian_context: true,
  });
}

fs.writeFileSync(t5Path, JSON.stringify(enriched, null, 2), 'utf-8');
console.log(`Successfully updated and enriched all ${enriched.length} guides in ${t5Path}!`);
