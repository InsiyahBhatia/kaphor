import { ImageSourcePropType } from 'react-native';

/** Names of the app icons (drawn with the Solar icon set in EditorialIcon.tsx). */
export const EditorialIcons = {
  home: true,
  shop: true,
  bag: true,
  tote: true,
  handbag: true,
  cart: true,
  hanger: true,
  dress: true,
  swap: true,
  rental: true,
  calendar: true,
  clock: true,
  profile: true,
  search: true,
  heart: true,
  heartFilled: true,
  bookmark: true,
  bell: true,
  mail: true,
  chat: true,
  help: true,
  camera: true,
  upload: true,
  verified: true,
  shield: true,
  gear: true,
  filter: true,
  grid: true,
  check: true,
  close: true,
  plus: true,
  minus: true,
  trash: true,
  recycle: true,
  leaf: true,
  scissors: true,
  thread: true,
  sewing: true,
  tape: true,
  yarn: true,
  buttons: true,
  sparkle: true,
  star: true,
  tag: true,
  wallet: true,
  card: true,
  shoe: true,
  boots: true,
  hat: true,
  stack: true,
  sunglasses: true,
  necklace: true,
  ring: true,
  bow: true,
} as const;

export type EditorialIconName = keyof typeof EditorialIcons;


export const EditorialFashion = {
  museHero: require('../../../assets/editorial/fashion/muse_hero.png'),
  parisFigure01: require('../../../assets/editorial/fashion/paris_figure_01.png'),
  parisFigure02: require('../../../assets/editorial/fashion/paris_figure_02.png'),
  parisFigure03: require('../../../assets/editorial/fashion/paris_figure_03.png'),
  parisFigure05: require('../../../assets/editorial/fashion/paris_figure_05.png'),
  parisFigure07: require('../../../assets/editorial/fashion/paris_figure_07.png'),
  parisFigure10: require('../../../assets/editorial/fashion/paris_figure_10.png'),
  parisFigure15: require('../../../assets/editorial/fashion/paris_figure_15.png'),
  parisFigure29: require('../../../assets/editorial/fashion/paris_figure_29.png'),
  styleFigure01: require('../../../assets/editorial/fashion/style_figure_01.png'),
  styleFigure06: require('../../../assets/editorial/fashion/style_figure_06.png'),
  styleFigure13: require('../../../assets/editorial/fashion/style_figure_13.png'),
  styleFigure26: require('../../../assets/editorial/fashion/style_figure_26.png'),
} as const;

export const EditorialRibbons = {
  flowingLeft: require('../../../assets/editorial/ribbons/flowing_ribbon_left.png'),
  flowingRight: require('../../../assets/editorial/ribbons/flowing_ribbon_right.png'),
  sticker01: require('../../../assets/editorial/ribbons/editorial_sticker_01.png'),
  sticker02: require('../../../assets/editorial/ribbons/editorial_sticker_02.png'),
  sticker03: require('../../../assets/editorial/ribbons/editorial_sticker_03.png'),
  sticker04: require('../../../assets/editorial/ribbons/editorial_sticker_04.png'),
} as const;

export const EditorialBotanicals = {
  sprig01: require('../../../assets/editorial/botanical/botanical_vintage_01.png'),
  sprig02: require('../../../assets/editorial/botanical/botanical_vintage_02.png'),
  sprig03: require('../../../assets/editorial/botanical/botanical_vintage_03.png'),
  sprig04: require('../../../assets/editorial/botanical/botanical_vintage_04.png'),
  sprig05: require('../../../assets/editorial/botanical/botanical_vintage_05.png'),
  sprig06: require('../../../assets/editorial/botanical/botanical_vintage_06.png'),
  sprig07: require('../../../assets/editorial/botanical/botanical_vintage_07.png'),
  sprig08: require('../../../assets/editorial/botanical/botanical_vintage_08.png'),
} as const;

export const EditorialCouture = {
  tool01: require('../../../assets/editorial/couture/couture_item_01.png'),
  tool02: require('../../../assets/editorial/couture/couture_item_02.png'),
  tool03: require('../../../assets/editorial/couture/couture_item_03.png'),
  tool04: require('../../../assets/editorial/couture/couture_item_04.png'),
  tool05: require('../../../assets/editorial/couture/couture_item_05.png'),
} as const;

export const EditorialAccents = {
  parisSketch01: require('../../../assets/editorial/accents/paris_sketch_01.png'),
  parisSketch02: require('../../../assets/editorial/accents/paris_sketch_02.png'),
  parisSketch03: require('../../../assets/editorial/accents/paris_sketch_03.png'),
  accent01: require('../../../assets/editorial/accents/editorial_accent_01.png'),
  accent02: require('../../../assets/editorial/accents/editorial_accent_02.png'),
  accent03: require('../../../assets/editorial/accents/editorial_accent_03.png'),
} as const;

export const EditorialIndian = {
  musePinkBanarasi: require('../../../assets/editorial/indian/muse_pink_banarasi.png'),
  museIvoryGajra: require('../../../assets/editorial/indian/muse_ivory_gajra.png'),
  royalCrimsonLehenga: require('../../../assets/editorial/indian/royal_crimson_lehenga.png'),
  jharokhaWindowGarlands: require('../../../assets/editorial/indian/jharokha_window_garlands.png'),
  udaipurLakePalace: require('../../../assets/editorial/indian/udaipur_lake_palace.png'),
  royalCrimsonPotli: require('../../../assets/editorial/indian/royal_crimson_potli.png'),
  pinkLotusFlower: require('../../../assets/editorial/indian/pink_lotus_flower.png'),
  royalWhiteElephant: require('../../../assets/editorial/indian/royal_white_elephant.png'),
  pichwaiSacredCow: require('../../../assets/editorial/indian/pichwai_sacred_cow.png'),
  brassGlowingDiya: require('../../../assets/editorial/indian/brass_glowing_diya.png'),
  royalZariMojaris: require('../../../assets/editorial/indian/royal_zari_mojaris.png'),
  royalEmbroideredParasol: require('../../../assets/editorial/indian/royal_embroidered_parasol.png'),
} as const;
