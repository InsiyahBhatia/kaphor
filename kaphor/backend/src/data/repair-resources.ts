/**
 * Verified repair and upcycle resources (YouTube tutorials and blog posts).
 *
 * Every video id was checked against the YouTube oEmbed endpoint and every blog
 * URL was checked with an HTTP request on 2026-10-05.
 * Add new entries only after doing the same checks. Do not invent links.
 *
 * Category groups: shirt, dress, jeans, sweater, saree, kurta, jacket, skirt,
 * activewear, general. 'general' entries fit any garment.
 */

export type ResourceMode = 'repair' | 'upcycle';

export interface VerifiedVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  mode: ResourceMode;
  categories: string[];
  damages: string[];
}

export interface VerifiedBlog {
  id: string;
  title: string;
  url: string;
  source: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  time_minutes: number;
  mode: ResourceMode;
  categories: string[];
  damages: string[];
}

export const VERIFIED_VIDEOS: VerifiedVideo[] = [
  { videoId: 'tkrc-V8sRlk', title: 'How to sew a hole - How to stitch a hole in clothes - Hand sew up a hole in pants, shirt, ', channelTitle: 'Cinderella Sew', mode: 'repair', categories: ['shirt', 'general'], damages: ['hole', 'tear'] },
  { videoId: 'NgNUXqlQPjI', title: 'How to fix the worn shirt collar in 5 minutes - a sewing trick!', channelTitle: 'Miarti - Sewing Tips', mode: 'repair', categories: ['shirt'], damages: ['collar', 'fray'] },
  { videoId: 'MmcEF2GR584', title: 'How to Sew a Button by Hand', channelTitle: 'Howcast', mode: 'repair', categories: ['shirt', 'general'], damages: ['button'] },
  { videoId: 'esy6hAYxTLs', title: 'How to Repair RIPPED HOLE in Dress Shirt & Save it from Landfill | SEWING HACKS', channelTitle: 'Sewing at Home Mom', mode: 'repair', categories: ['shirt'], damages: ['hole', 'tear'] },
  { videoId: 'pYuM0QheOxc', title: 'How to Repair a Fabric Tear with an Invisible Stitch', channelTitle: 'Guiding Bolt', mode: 'repair', categories: ['dress', 'kurta', 'general'], damages: ['tear', 'seam'] },
  { videoId: 'WKDSiqqgLAk', title: 'How to hem a dress - No sewing machine - Hand sewing hemming tutorial - Easy way to hem cl', channelTitle: 'Cinderella Sew', mode: 'repair', categories: ['dress', 'skirt'], damages: ['hem'] },
  { videoId: 'f5yyHj4ZnpE', title: 'How to Hem a Dress by Hand Using the Blind Stitch (blind hem)', channelTitle: 'Knots & Kneedles', mode: 'repair', categories: ['dress', 'skirt'], damages: ['hem'] },
  { videoId: 'eEKWOslrFgU', title: 'How to fix Zipper on a Dress / How to Repair An Zipper /Easy How: To fix a Zipper Like a P', channelTitle: 'Saira\'s Creations', mode: 'repair', categories: ['dress'], damages: ['zipper'] },
  { videoId: 'HtsC7emyg90', title: 'Repair Jeans with Sashiko and Whipstitches | Visible Mending Tutorial', channelTitle: 'Xiaoxiao Yarn', mode: 'repair', categories: ['jeans'], damages: ['hole', 'tear'] },
  { videoId: 'mRtUi_YXK9Y', title: 'How To Repair Jeans Using Visible Mending', channelTitle: 'Sew Anastasia', mode: 'repair', categories: ['jeans'], damages: ['hole', 'tear'] },
  { videoId: 'UbxJvjElhPA', title: 'Mending jeans! The dreaded crotch blowout!', channelTitle: 'The Domesticated Bear', mode: 'repair', categories: ['jeans'], damages: ['hole', 'tear', 'seam'] },
  { videoId: '51nns6EUSgI', title: 'How to Fix the Ripped Crotch of your Jeans : 3 Innovative Ways!', channelTitle: 'Downtown Tailoring', mode: 'repair', categories: ['jeans'], damages: ['hole', 'tear', 'seam'] },
  { videoId: 'XITU7ksBQbw', title: 'How to darn a hole in a sweater | Care & Repair | Donna Wilson', channelTitle: 'Donna Wilson', mode: 'repair', categories: ['sweater'], damages: ['hole'] },
  { videoId: 'AVVawL1LD6Y', title: 'How to Mend Holes in Knitwear', channelTitle: 'Repair What You Wear', mode: 'repair', categories: ['sweater'], damages: ['hole'] },
  { videoId: '4FdxWUhAaGs', title: 'How To Repair A Snag In A Jumper', channelTitle: 'Scribble', mode: 'repair', categories: ['sweater'], damages: ['snag'] },
  { videoId: 'fjQbccs9t4c', title: 'How to Fix a Snag/Pull in Knits! | WITHWENDY', channelTitle: 'withwendy', mode: 'repair', categories: ['sweater'], damages: ['snag'] },
  { videoId: 'NSrzjD-IBpc', title: 'Learn how to repair the largest iron burn hole in banarasi silk zari saree', channelTitle: 'handwork creativity', mode: 'repair', categories: ['saree'], damages: ['hole', 'burn'] },
  { videoId: 'hIzzIjSReyE', title: 'learn how to repair hole in silk sarees/रेशम साड़ियों की मरम्मत', channelTitle: 'handwork creativity', mode: 'repair', categories: ['saree'], damages: ['hole', 'tear'] },
  { videoId: 'mUE_ATvXIdA', title: 'How To Sew A Torn Seam', channelTitle: 'Scribble', mode: 'repair', categories: ['kurta', 'general'], damages: ['seam', 'tear'] },
  { videoId: 'dj31i4Hj2JA', title: 'How To Repair A Frayed or Stressed Seam', channelTitle: 'Niler Taylor', mode: 'repair', categories: ['kurta', 'general'], damages: ['seam', 'fray'] },
  { videoId: 'GPJhN0AAY6U', title: 'How To Fix The Lining In Your Coat', channelTitle: 'Thimble-Art', mode: 'repair', categories: ['jacket'], damages: ['lining', 'tear'] },
  { videoId: 'pzfJLwxz3aw', title: 'How to fix a rip in coat lining - Repair ripped lining in a jacket - Sew a hole in lining ', channelTitle: 'Cinderella Sew', mode: 'repair', categories: ['jacket'], damages: ['lining', 'tear'] },
  { videoId: 'FzesfQ_zW1U', title: '⭐How to fix a hole in a jacket in 2 minutes / repair clothes', channelTitle: 'My DIY style', mode: 'repair', categories: ['jacket'], damages: ['hole', 'tear'] },
  { videoId: 'vLv2wxsnzr0', title: 'How To FIX Moth Holes in A Suit Jacket in Under 3 Minutes', channelTitle: 'Assembled Style', mode: 'repair', categories: ['jacket'], damages: ['hole'] },
  { videoId: 'CQpXKgehxc4', title: 'How to Hem a Skirt or Dress by Hand. Classic Hem Stitch by hand', channelTitle: 'Sewway', mode: 'repair', categories: ['skirt'], damages: ['hem'] },
  { videoId: 'pbiQt9RJg2Q', title: 'How to Sew a Blind Hem by Hand - EASY!', channelTitle: 'Cutesy Crafts', mode: 'repair', categories: ['skirt', 'dress', 'general'], damages: ['hem'] },
  { videoId: 'Du6gq3ks0SQ', title: 'How to Sew a Button - for Absolute BEGINNERS', channelTitle: 'Treasurie', mode: 'repair', categories: ['general'], damages: ['button'] },
  { videoId: '3dkKaYERCNI', title: 'How To Fix a Broken Zipper', channelTitle: 'HowToBasic', mode: 'repair', categories: ['general'], damages: ['zipper'] },
  { videoId: 'OkzVh29lmEU', title: 'How to Fix a Zipper That\'s Come Off One Side of the Track', channelTitle: 'Guiding Bolt', mode: 'repair', categories: ['general'], damages: ['zipper'] },
  { videoId: 'wrSFIWG-mqU', title: 'How to Fix Every Zipper Issue', channelTitle: 'Lifehacker', mode: 'repair', categories: ['general'], damages: ['zipper'] },
  { videoId: 'CHzLckkSATI', title: 'How to Remove Stains From Clothes At Home Better Than The Dry Cleaner', channelTitle: 'Gentleman\'s Gazette', mode: 'repair', categories: ['general'], damages: ['stain'] },
  { videoId: 'dfJi49umT6U', title: 'How to Get (Almost) Every Kind of Stain Out of Your Clothes', channelTitle: 'Rachael Ray Show', mode: 'repair', categories: ['general'], damages: ['stain'] },
  { videoId: 'KyDXE89Tyfo', title: 'UPCYCLING TUTORIAL: Button Up Dress Shirt to Flowy Summer Top | trashnfashn', channelTitle: 'trashnfashn', mode: 'upcycle', categories: ['shirt', 'general'], damages: [] },
  { videoId: 'ppAokA7is1o', title: 'UPCYCLING TUTORIAL: Dress Shirt to Fitted Collared Blouse | trashnfashn', channelTitle: 'trashnfashn', mode: 'upcycle', categories: ['shirt'], damages: [] },
  { videoId: 'GAoSGQoL4pw', title: '7 diy shirt upcycles *no sew* ☆*.⋆｡⋆', channelTitle: 'Leyla Tavas', mode: 'upcycle', categories: ['shirt', 'general'], damages: [] },
  { videoId: 'H0Jna2EDs2U', title: '4 EASY T-Shirt Upcycle Ideas (No-Sew!) ✨ | DIY with Orly Shani', channelTitle: 'Orly Shani', mode: 'upcycle', categories: ['shirt'], damages: [] },
  { videoId: 'o75LptAui2g', title: 'How to make a T-Shirt Bag / DIY No Sew T-Shirt Bag /Old T-Shirt Reuse Idea / T-Shirt To sh', channelTitle: 'RNS crafts', mode: 'upcycle', categories: ['shirt'], damages: [] },
  { videoId: '1elgA9gLtpg', title: 'Skirt into Dress | Recycle Modify Old Skirt | Thrifted Transformation | DiyFashion TV | Ta', channelTitle: 'Gwnam Konam', mode: 'upcycle', categories: ['dress', 'skirt'], damages: [] },
  { videoId: 'PM0TUQi2xZY', title: 'Clothes to make out of old jeans || 100 Upcycled Jean Ideas || Thrift Flip Sewing Projects', channelTitle: 'Shanía O.', mode: 'upcycle', categories: ['jeans'], damages: [] },
  { videoId: 'TEtpCWTKyV0', title: 'Never throw away your old Jeans again - 👖DENIM UPCYCLING ♻️ & STYLING HAUL 🤯🫨', channelTitle: 'Anh creates things', mode: 'upcycle', categories: ['jeans'], damages: [] },
  { videoId: 'ENMejcvtru8', title: '20 Clever Ways To Recycled Old Jeans', channelTitle: 'Home & Ideas', mode: 'upcycle', categories: ['jeans'], damages: [] },
  { videoId: 'P9D-CPdGi5A', title: 'Make mittens from old sweaters - Fast and Easy!', channelTitle: 'Sandy Luft-Schafer', mode: 'upcycle', categories: ['sweater'], damages: [] },
  { videoId: 'OEhOP3fstC0', title: 'DIY: Make Mittens from Sweaters in Minutes', channelTitle: 'Crème de la Craft', mode: 'upcycle', categories: ['sweater'], damages: [] },
  { videoId: 'eIM8EwDqLjM', title: 'Upcycled Sweater Mittens: step by step tutorial', channelTitle: 'Jan Howell', mode: 'upcycle', categories: ['sweater'], damages: [] },
  { videoId: 'Yf9Mdv4mb5k', title: 'Old Sweater? Here’s How to Turn in Into a Hat', channelTitle: 'Nikki Davidson', mode: 'upcycle', categories: ['sweater'], damages: [] },
  { videoId: 'ZgK9mOTC5Xg', title: '5 Amazing Ideas To Reuse Old Sarees | Recycle Old Sarees & Blouse Pieces (In Hindi)', channelTitle: 'Simplify Your Space', mode: 'upcycle', categories: ['saree'], damages: [] },
  { videoId: '5Tljfv97-e0', title: 'Old Sarees Ideas l Best Reuse Hacks of Old Saree l Sonali\'s Creations', channelTitle: 'Sonali\'s Creations', mode: 'upcycle', categories: ['saree'], damages: [] },
  { videoId: 'TivIt7pBcRM', title: '“OLD Sarees to STUNNING Outfits 😍 | Client Projects | Saree Reuse Ideas”', channelTitle: 'fashion fusions', mode: 'upcycle', categories: ['saree'], damages: [] },
  { videoId: 'hLkW3hG2fc8', title: 'पुरानी कुर्ती से बनाए |Old suit reuse idea |new idea from kurti | bag banane ka tarika #di', channelTitle: 'Seema Silai Tips', mode: 'upcycle', categories: ['kurta'], damages: [] },
  { videoId: 'd8zG-AWExjA', title: 'Kurti का एसा IDEA आपने आज तक नहीं देखा होगा # Old Kurti Re Use Idea # Best Re Use Idea', channelTitle: 'HAND MADE Ideas', mode: 'upcycle', categories: ['kurta'], damages: [] },
  { videoId: 'AGl8OQHq2Jk', title: 'Refashion DIY Coat into Two Piece Matching Set 💖 Old coat → Luxury set 🤩 Thrift Flip', channelTitle: 'AssunDIY', mode: 'upcycle', categories: ['jacket'], damages: [] },
  { videoId: '3VSDnKkgCFs', title: 'This EASY Blazer Refashion Is On ANOTHER LEVEL-With or Without Sewing(What to do with an o', channelTitle: 'Delusional Designer - Peer Cox Fashion Rec.', mode: 'upcycle', categories: ['jacket'], damages: [] },
  { videoId: 'VwazrsRV59Y', title: 'Upcycle your Denim Jackets! T-shirt Transformation', channelTitle: 'Somethingflava', mode: 'upcycle', categories: ['jacket'], damages: [] },
  { videoId: 'APl8LvZS6sc', title: 'DIY - Convert Skirt into Palazzo Pant || Re-Fashion your old dresses || Reuse Projects', channelTitle: 'CAMVIN', mode: 'upcycle', categories: ['skirt'], damages: [] },
  { videoId: '_zlHBxHpWx4', title: 'Refashion Skirt Into Top (5 Zero Waste Upcycle Projects)', channelTitle: 'Fashion Wanderer', mode: 'upcycle', categories: ['skirt'], damages: [] },
  { videoId: 'omMrVGcWa8Q', title: 'More than 20 ideas to alter, customize, and upcycle your clothes (instead of shopping)', channelTitle: 'Outfit Repeater', mode: 'upcycle', categories: ['general'], damages: [] },
  { videoId: 'l7l1kWhWQAs', title: 'THRIFT FLIP | 7 simple diy clothing transformations to update my thrift pile | WELL-LOVED', channelTitle: 'Well-Loved', mode: 'upcycle', categories: ['general'], damages: [] },
  { videoId: 'uxf2ScP45I4', title: '100 Upcycle Fashion Ideas | Sewing Projects to Make and Sell', channelTitle: 'Shanía O.', mode: 'upcycle', categories: ['general'], damages: [] },
  { videoId: '8KRnu5Ibz_g', title: '50+ STYLISH Ideas and Upcycled Clothing Projects You\'ll LOVE', channelTitle: 'Miz Angela Sawyer', mode: 'upcycle', categories: ['general'], damages: [] },
];

export const VERIFIED_BLOGS: VerifiedBlog[] = [
  { id: 'blog-001', title: 'Invisible stitch: how to fix a tear', url: 'https://ageberry.com/invisible-stitch/', source: 'Ageberry', difficulty: 'beginner', time_minutes: 15, mode: 'repair', categories: ['general'], damages: ['tear', 'seam', 'hem'] },
  { id: 'blog-002', title: 'Ladder stitch for beginners', url: 'https://blog.treasurie.com/invisible-stitch-ladder/', source: 'Treasurie', difficulty: 'beginner', time_minutes: 10, mode: 'repair', categories: ['general'], damages: ['seam', 'tear'] },
  { id: 'blog-003', title: 'Invisible mending, step by step', url: 'https://mellysews.com/invisible-mending-step-by-step/', source: 'Melly Sews', difficulty: 'intermediate', time_minutes: 30, mode: 'repair', categories: ['general'], damages: ['hole', 'tear'] },
  { id: 'blog-004', title: 'How to sew a rip', url: 'https://knittystitchy.com/how-to-sew-a-rip/', source: 'Knitty Stitchy', difficulty: 'beginner', time_minutes: 15, mode: 'repair', categories: ['general'], damages: ['tear', 'seam'] },
  { id: 'blog-005', title: 'Visible mending in 5 steps', url: 'https://sewing.com/visible-mending-repair-a-5-step-beginner-guide/', source: 'Sewing.com', difficulty: 'beginner', time_minutes: 30, mode: 'repair', categories: ['general'], damages: ['hole', 'tear'] },
  { id: 'blog-006', title: 'Visible mending with patches and embroidery', url: 'https://craftsy.com/post/visible-mending-patching-and-embroidery', source: 'Craftsy', difficulty: 'intermediate', time_minutes: 45, mode: 'repair', categories: ['general'], damages: ['hole', 'stain'] },
  { id: 'blog-007', title: 'Embroidery ideas for visible mending', url: 'https://yarnspirations.com/blogs/how-to/beautiful-embroidery-ideas-for-visible-mending', source: 'Yarnspirations', difficulty: 'intermediate', time_minutes: 40, mode: 'repair', categories: ['general', 'jeans'], damages: ['hole', 'stain'] },
  { id: 'blog-008', title: 'Lovely visible mending of clothes', url: 'https://sostrenegrene.com/en-gb/diy/lovely-visible-mending-of-clothes-d-7060', source: 'Sostrene Grene', difficulty: 'beginner', time_minutes: 30, mode: 'repair', categories: ['general'], damages: ['hole'] },
  { id: 'blog-009', title: 'How to darn a hole in your clothes', url: 'https://www.oxfam.org.uk/oxfam-in-action/oxfam-blog/how-to-darn/', source: 'Oxfam', difficulty: 'beginner', time_minutes: 30, mode: 'repair', categories: ['sweater', 'general'], damages: ['hole'] },
  { id: 'blog-010', title: 'Mend knitwear with Swiss darning', url: 'https://www.flockworkshop.uk/journal/how-to-swiss-darn', source: 'Flock Workshop', difficulty: 'intermediate', time_minutes: 45, mode: 'repair', categories: ['sweater'], damages: ['hole'] },
  { id: 'blog-011', title: 'Mend small holes in your sweater', url: 'https://circularknittingjourney.substack.com/p/mend-the-smallish-holes-in-your-sweater', source: 'Circular Knitting Journey', difficulty: 'beginner', time_minutes: 30, mode: 'repair', categories: ['sweater'], damages: ['hole'] },
  { id: 'blog-012', title: 'Woven darn a hole in a knit', url: 'https://www.ifixit.com/Guide/Woven%20Darn%20a%20Hole%20in%20a%20Knit/185402', source: 'iFixit', difficulty: 'intermediate', time_minutes: 30, mode: 'repair', categories: ['sweater'], damages: ['hole'] },
  { id: 'blog-013', title: 'Visible knitwear mending how-to', url: 'https://yarnspirations.com/blogs/how-to/visible-knitwear-mending', source: 'Yarnspirations', difficulty: 'intermediate', time_minutes: 45, mode: 'repair', categories: ['sweater'], damages: ['hole'] },
  { id: 'blog-014', title: 'How to fix a hole in knitting', url: 'https://knittingtips.net/guides/fixing-holes/', source: 'Knittingtips', difficulty: 'intermediate', time_minutes: 30, mode: 'repair', categories: ['sweater'], damages: ['hole'] },
  { id: 'blog-015', title: 'How to mend moth holes', url: 'https://www.theguardian.com/lifeandstyle/2014/sep/22/how-to-mend-moth-holes', source: 'The Guardian', difficulty: 'beginner', time_minutes: 20, mode: 'repair', categories: ['sweater', 'jacket'], damages: ['hole'] },
  { id: 'blog-016', title: 'How to fix a snagged knit', url: 'https://sewyoursoul.com/how-to-fix-a-snagged-knit-fabric/', source: 'Sew Your Soul', difficulty: 'beginner', time_minutes: 10, mode: 'repair', categories: ['sweater'], damages: ['snag'] },
  { id: 'blog-017', title: 'How to fix a pull on a jumper', url: 'https://www.oliverbonas.com/care-guides/fashion/fix-a-pull-on-a-jumper', source: 'Oliver Bonas', difficulty: 'beginner', time_minutes: 10, mode: 'repair', categories: ['sweater'], damages: ['snag'] },
  { id: 'blog-018', title: 'Repair pulled threads on knit sweaters', url: 'https://opposuits.com/blogs/opposuits/how-to-repair-pulled-threads-on-knit-sweaters', source: 'Opposuits', difficulty: 'beginner', time_minutes: 10, mode: 'repair', categories: ['sweater'], damages: ['snag'] },
  { id: 'blog-019', title: 'Repair a snag in knit clothing', url: 'https://ifixit.com/Guide/How+to+repair+a+Snag+in+Knit+Clothing/53938', source: 'iFixit', difficulty: 'beginner', time_minutes: 10, mode: 'repair', categories: ['sweater'], damages: ['snag'] },
  { id: 'blog-020', title: 'Remove pilling from sweaters safely', url: 'https://thequalitythread.com/how-to-remove-pilling-from-sweaters/', source: 'The Quality Thread', difficulty: 'beginner', time_minutes: 15, mode: 'repair', categories: ['sweater'], damages: ['pilling'] },
  { id: 'blog-021', title: 'Pilling, snags, holes and fraying', url: 'https://fondsites.com/keepers-guild/guidebooks/pilling-snags-holes-fraying/', source: 'Fondsites', difficulty: 'beginner', time_minutes: 15, mode: 'repair', categories: ['sweater', 'general'], damages: ['pilling', 'snag', 'hole', 'fray'] },
  { id: 'blog-022', title: 'How to tighten sleeve cuffs', url: 'https://seamwhisperer.com/tighten-sleeve-cuffs/', source: 'Seam Whisperer', difficulty: 'beginner', time_minutes: 20, mode: 'repair', categories: ['sweater', 'jacket', 'shirt'], damages: ['cuff', 'stretch'] },
  { id: 'blog-023', title: 'Fix stretched cuffs, necks and hems', url: 'https://tenrowsaday.com/fix-stretched-bands/', source: '10 Rows a Day', difficulty: 'beginner', time_minutes: 20, mode: 'repair', categories: ['sweater'], damages: ['stretch', 'cuff', 'hem'] },
  { id: 'blog-024', title: 'How to sew a button', url: 'https://www.wikihow.com/Sew-a-Button', source: 'wikiHow', difficulty: 'beginner', time_minutes: 10, mode: 'repair', categories: ['shirt', 'general'], damages: ['button'] },
  { id: 'blog-025', title: 'How to sew a button on a shirt', url: 'https://sewingtrip.com/how-to-sew-a-button-on-a-shirt/', source: 'Sewing Trip', difficulty: 'beginner', time_minutes: 10, mode: 'repair', categories: ['shirt'], damages: ['button'] },
  { id: 'blog-026', title: 'Sew a button that stays put', url: 'https://helpwithdiy.com/how-to-sew-a-button/', source: 'Help With DIY', difficulty: 'beginner', time_minutes: 10, mode: 'repair', categories: ['shirt', 'general'], damages: ['button'] },
  { id: 'blog-027', title: 'Replace a stuck zipper on jeans and jackets', url: 'https://beadnova.com/blog/22912/how-to-replace-zipper/', source: 'Beadnova', difficulty: 'intermediate', time_minutes: 45, mode: 'repair', categories: ['jeans', 'jacket'], damages: ['zipper'] },
  { id: 'blog-028', title: 'Sashiko-style mending for jeans', url: 'https://practicalembroidery.eu/sashiko-style-mending-tutorial-for-repairing-jeans/', source: 'Practical Embroidery', difficulty: 'intermediate', time_minutes: 45, mode: 'repair', categories: ['jeans'], damages: ['hole', 'tear'] },
  { id: 'blog-029', title: 'Patch jeans: two easy ways', url: 'https://blog.closetcorepatterns.com/how-to-fix-ripped-jeans-with-visible-mending/', source: 'Closet Core Patterns', difficulty: 'beginner', time_minutes: 30, mode: 'repair', categories: ['jeans'], damages: ['hole', 'tear'] },
  { id: 'blog-030', title: 'Visible mending: sashiko jeans patch', url: 'https://blog.clover-usa.com/2020/05/20/visible-mending-sashiko-jeans-patch/', source: 'Clover', difficulty: 'intermediate', time_minutes: 45, mode: 'repair', categories: ['jeans'], damages: ['hole', 'tear'] },
  { id: 'blog-031', title: 'Sashiko denim repair for beginners', url: 'https://denimhunters.com/sashiko-denim-repair-guide/', source: 'Denimhunters', difficulty: 'beginner', time_minutes: 45, mode: 'repair', categories: ['jeans'], damages: ['hole', 'tear'] },
  { id: 'blog-032', title: 'How to fix crotch holes in jeans', url: 'https://theruffledpurse.com/how-to-fix-crotch-holes-in-jeans/', source: 'The Ruffled Purse', difficulty: 'beginner', time_minutes: 30, mode: 'repair', categories: ['jeans'], damages: ['hole', 'tear', 'seam'] },
  { id: 'blog-033', title: '5 ways to fix a crotch hole in jeans', url: 'https://wikihow.com/Fix-the-Crotch-Hole-in-Your-Jeans', source: 'wikiHow', difficulty: 'beginner', time_minutes: 30, mode: 'repair', categories: ['jeans'], damages: ['hole', 'tear', 'seam'] },
  { id: 'blog-034', title: 'Fix a jeans crotch hole without sewing', url: 'https://fashionwanderer.com/how-to-fix-hole-in-jeans-crotch-without-sewing/', source: 'Fashion Wanderer', difficulty: 'beginner', time_minutes: 15, mode: 'repair', categories: ['jeans'], damages: ['hole', 'tear'] },
  { id: 'blog-035', title: 'Visible mending for a denim jacket', url: 'https://fashionwanderer.com/visible-mending-denim-jacket-tutorial/', source: 'Fashion Wanderer', difficulty: 'intermediate', time_minutes: 45, mode: 'repair', categories: ['jacket', 'jeans'], damages: ['hole', 'tear'] },
  { id: 'blog-036', title: 'Hem pants yourself', url: 'https://mellysews.com/hem-pants-yourself/', source: 'Melly Sews', difficulty: 'beginner', time_minutes: 30, mode: 'repair', categories: ['jeans'], damages: ['hem'] },
  { id: 'blog-037', title: 'Get sweat stains out of dress shirts', url: 'https://www.thetiebar.com/blogs/news/how-to-get-rid-of-sweat-stains-on-dress-shirts', source: 'The Tie Bar', difficulty: 'beginner', time_minutes: 15, mode: 'repair', categories: ['shirt'], damages: ['stain'] },
  { id: 'blog-038', title: 'How to remove stains from cotton', url: 'https://selvane.co/blogs/knowledge/how-to-remove-stains-from-cotton-a-practical-guide', source: 'Selvane', difficulty: 'beginner', time_minutes: 15, mode: 'repair', categories: ['shirt', 'general'], damages: ['stain'] },
  { id: 'blog-039', title: 'Fix a tear in a jacket lining', url: 'https://ifixit.com/Guide/How+to+Fix+a+Tear+in+a+Jacket+Lining/142374', source: 'iFixit', difficulty: 'beginner', time_minutes: 15, mode: 'repair', categories: ['jacket'], damages: ['lining', 'tear'] },
  { id: 'blog-040', title: 'Fix a ripped jacket lining', url: 'https://cinderellasew.com/2026/04/how-to-fix-ripped-lining-sew-tear-in.html', source: 'Cinderella Sew', difficulty: 'beginner', time_minutes: 15, mode: 'repair', categories: ['jacket'], damages: ['lining', 'tear'] },
  { id: 'blog-041', title: 'Patch a down jacket at home', url: 'https://burton.com/en-us/blogs/the-burton-blog/down-jacket-patch', source: 'Burton', difficulty: 'beginner', time_minutes: 20, mode: 'repair', categories: ['jacket'], damages: ['hole', 'tear'] },
  { id: 'blog-042', title: 'Patch an insulated jacket with tape', url: 'https://ifixit.com/Guide/Patch+an+Insulated+Jacket+with+Repair+Tape/19431', source: 'iFixit', difficulty: 'beginner', time_minutes: 10, mode: 'repair', categories: ['jacket'], damages: ['hole', 'tear'] },
  { id: 'blog-043', title: 'Repair a leather jacket', url: 'https://wikihow.com/Repair-a-Leather-Jacket', source: 'wikiHow', difficulty: 'intermediate', time_minutes: 45, mode: 'repair', categories: ['jacket'], damages: ['tear', 'scuff'] },
  { id: 'blog-044', title: 'Repair a torn legging seam', url: 'https://ifixit.com/Guide/How+to+repair+a+torn+legging+seam/169529', source: 'iFixit', difficulty: 'beginner', time_minutes: 15, mode: 'repair', categories: ['activewear'], damages: ['seam', 'tear'] },
  { id: 'blog-045', title: 'Fix holes in leggings', url: 'https://sewingtrip.com/how-to-fix-holes-in-leggings/', source: 'Sewing Trip', difficulty: 'beginner', time_minutes: 15, mode: 'repair', categories: ['activewear'], damages: ['hole', 'tear'] },
  { id: 'blog-046', title: 'Fix holes in stretch fabric', url: 'https://modamaterial.com/spandex-stretch-fabrics-hole-repair/', source: 'Moda Material', difficulty: 'beginner', time_minutes: 15, mode: 'repair', categories: ['activewear'], damages: ['hole', 'tear'] },
  { id: 'blog-047', title: 'Upcycle a shirt into an apron', url: 'https://weallsew.com/how-to-upcycle-a-shirt-to-an-apron/', source: 'WeAllSew', difficulty: 'beginner', time_minutes: 60, mode: 'upcycle', categories: ['shirt'], damages: [] },
  { id: 'blog-048', title: 'No-sew T-shirt tote bag', url: 'https://diycandy.com/t-shirt-tote-bag/', source: 'DIY Candy', difficulty: 'beginner', time_minutes: 30, mode: 'upcycle', categories: ['shirt'], damages: [] },
  { id: 'blog-049', title: 'No-sew T-shirt cushion', url: 'https://diythought.com/no-sew-t-shirt-cushion/', source: 'DIY Thought', difficulty: 'beginner', time_minutes: 30, mode: 'upcycle', categories: ['shirt'], damages: [] },
  { id: 'blog-050', title: 'Make a pillow from a shirt', url: 'https://wikihow.com/Make-a-Shirt-Pillow', source: 'wikiHow', difficulty: 'beginner', time_minutes: 45, mode: 'upcycle', categories: ['shirt'], damages: [] },
  { id: 'blog-051', title: 'No-sew braided T-shirt rug', url: 'https://thewonderforest.com/how-to-make-no-sew-round-braided-rug/', source: 'Wonder Forest', difficulty: 'intermediate', time_minutes: 120, mode: 'upcycle', categories: ['shirt'], damages: [] },
  { id: 'blog-052', title: 'Cut old jeans into shorts: 7 ideas', url: 'https://sewguide.com/diy-cut-off-jean-shorts/', source: 'SewGuide', difficulty: 'beginner', time_minutes: 30, mode: 'upcycle', categories: ['jeans'], damages: [] },
  { id: 'blog-053', title: 'Turn old jeans into shorts', url: 'https://sewing4free.com/turn-old-jeans-into-cute-shorts-an-easy-upcycle/', source: 'Sewing 4 Free', difficulty: 'beginner', time_minutes: 45, mode: 'upcycle', categories: ['jeans'], damages: [] },
  { id: 'blog-054', title: 'DIY jean cutoff shorts', url: 'https://remake.world/stories/style/how-to-diy-jean-cutoff-shorts/', source: 'Remake', difficulty: 'beginner', time_minutes: 30, mode: 'upcycle', categories: ['jeans'], damages: [] },
  { id: 'blog-055', title: 'How to make cutoff jean shorts', url: 'https://emmyloustyles.com/how-to-make-cutoff-jean-shorts/', source: 'Emmy Lou Styles', difficulty: 'beginner', time_minutes: 30, mode: 'upcycle', categories: ['jeans'], damages: [] },
  { id: 'blog-056', title: 'Jeans to shorts with a fabric cuff', url: 'https://blog.siysewityourself.com/2025/08/08/sewing-refashion-upcycle-jeans-to-shorts-with-a-fabric-cuff/', source: 'SIY Blog', difficulty: 'intermediate', time_minutes: 60, mode: 'upcycle', categories: ['jeans'], damages: [] },
  { id: 'blog-057', title: 'Turn old jeans into a tote bag', url: 'https://thecreativesewist.com/upcycled-sewing-project-turn-old-jeans-into-tote-bag/', source: 'The Creative Sewist', difficulty: 'intermediate', time_minutes: 90, mode: 'upcycle', categories: ['jeans'], damages: [] },
  { id: 'blog-058', title: 'DIY jean tote bag', url: 'https://liviolee.com/diy-jean-tote-bag/', source: 'Livio Lee', difficulty: 'intermediate', time_minutes: 90, mode: 'upcycle', categories: ['jeans'], damages: [] },
  { id: 'blog-059', title: 'Upcycle jeans into a tote bag', url: 'https://heatherhandmade.com/upcycle-jeans-tote-bag/', source: 'Heather Handmade', difficulty: 'intermediate', time_minutes: 90, mode: 'upcycle', categories: ['jeans'], damages: [] },
  { id: 'blog-060', title: 'Sweater to beanie and mittens', url: 'https://mellysews.com/thrift-flip-sweater-upcycle-to-beanie-and-mittens/', source: 'Melly Sews', difficulty: 'intermediate', time_minutes: 60, mode: 'upcycle', categories: ['sweater'], damages: [] },
  { id: 'blog-061', title: 'Sweater into a hat and long mittens', url: 'https://shrimpsaladcircus.com/sewing-tutorial-sweater-into-hat-long-mittens/', source: 'Shrimp Salad Circus', difficulty: 'intermediate', time_minutes: 60, mode: 'upcycle', categories: ['sweater'], damages: [] },
  { id: 'blog-062', title: 'Upcycled sweater mittens', url: 'https://therenegadeseamstress.com/2021/01/23/upcycled-sweater-mitten-tutorial-and-pattern-just-like-bernies/', source: 'Renegade Seamstress', difficulty: 'beginner', time_minutes: 45, mode: 'upcycle', categories: ['sweater'], damages: [] },
  { id: 'blog-063', title: 'Turn an old saree into an anarkali kurti', url: 'https://herzindagi.com/fashion/old-saree-designer-anarkali-kurti-article-289532', source: 'HerZindagi', difficulty: 'intermediate', time_minutes: 120, mode: 'upcycle', categories: ['saree', 'kurta'], damages: [] },
];
