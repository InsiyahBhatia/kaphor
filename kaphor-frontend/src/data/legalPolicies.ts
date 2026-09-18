export interface LegalClause {
  heading: string;
  content: string;
  legalBasis?: string;
}

export interface LegalDocument {
  id: string;
  title: string;
  shortTitle: string;
  icon: string;
  badge: string;
  statutoryReference: string;
  quickTake: string[];
  clauses: LegalClause[];
}

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    id: 'terms-and-conditions',
    title: 'Master Terms & Conditions',
    shortTitle: 'Terms of Use',
    icon: 'document-text-outline',
    badge: 'IT ACT 2000 § 79',
    statutoryReference: 'Information Technology Act, 2000 • IT Rules 2021 • Consumer Protection Act, 2019 • Indian Contract Act, 1872',
    quickTake: [
      'You must be at least 18 years old and provide accurate profile information to buy, sell, rent, or swap.',
      'KaPhor operates as an electronic intermediary under Section 79 of the IT Act — we facilitate P2P connections, but items are owned and listed by independent users.',
      'Payments are processed through RBI-authorized payment aggregators; card numbers are never stored on KaPhor servers.',
      'Disputes are resolved through our Grievance Officer and amicable arbitration, without waiving any statutory rights under the Consumer Protection Act.',
    ],
    clauses: [
      {
        heading: '1. Who Can Use KaPhor & Account Security',
        content:
          'You must be at least 18 years of age and legally competent to enter into a contract under Indian law to register, transact, buy, sell, rent, or swap on KaPhor. By creating an account, you warrant that all information provided is accurate and truthful, and you agree to maintain the confidentiality of your credentials.',
        legalBasis: 'Indian Contract Act, 1872 (Capacity to contract); IT (Intermediary Guidelines) Rules, 2021 (User due-diligence).',
      },
      {
        heading: '2. Electronic Intermediary Status & Safe Harbour Protection',
        content:
          'KaPhor is an electronic marketplace and communication facilitator under Section 79 of the Information Technology Act, 2000. KaPhor does not pre-screen every user listing, manufacture items, warrant merchantability, or take title to traded goods. All sales, rentals, and swaps constitute direct, private bipartite agreements between the transacting users.',
        legalBasis: 'Information Technology Act, 2000, Section 79 (Intermediary safe harbour exemption conditional on due-diligence).',
      },
      {
        heading: '3. Secure Payments & Escrow Payout Mechanics',
        content:
          'All financial transactions on KaPhor are handled by RBI-authorized payment aggregators (such as Razorpay/Stripe). KaPhor does not collect or retain card or banking credentials. Seller and swapper payouts are held in escrow settlement accounts and disbursed once delivery verification and return windows conclude.',
        legalBasis: 'Payment and Settlement Systems Act, 2007; RBI Master Directions on Payment Aggregators & Gateways.',
      },
      {
        heading: '4. Prohibited Conduct & Content Moderation',
        content:
          'Users may not list counterfeit items, stolen goods, hazardous materials, or infringements of intellectual property. KaPhor reserves the right to suspend accounts, unpublish listings, and cooperate with law enforcement in accordance with statutory takedown obligations.',
        legalBasis: 'Trade Marks Act, 1999; Bharatiya Nyaya Sanhita, 2023; IT Rules, 2021 Rule 3(1)(d).',
      },
      {
        heading: '5. Dispute Resolution & Governing Law',
        content:
          'This agreement is governed by the laws of the Republic of India. Users agree to first seek informal resolution via our designated Grievance Officer. If unresolved, disputes may be referred to binding arbitration in India. Nothing herein restricts a consumer from approaching a competent Consumer Commission under the Consumer Protection Act, 2019.',
        legalBasis: 'Arbitration and Conciliation Act, 1996; Consumer Protection Act, 2019.',
      },
    ],
  },
  {
    id: 'privacy-policy',
    title: 'Privacy Policy & Data Protection Notice',
    shortTitle: 'Privacy Policy',
    icon: 'shield-checkmark-outline',
    badge: 'DPDP ACT 2023',
    statutoryReference: 'Digital Personal Data Protection Act, 2023 • DPDP Rules 2025 • Information Technology Act, 2000',
    quickTake: [
      'We collect personal identifiers, style quiz answers (Style Vector), and uploaded garment photos to power discovery and AI condition check.',
      'Your data is never sold to data brokers or third-party advertisers.',
      'You hold statutory rights to access, correct, export, and request complete erasure of your personal profile data.',
      'Images and transaction records are stored on secure cloud servers complying with Indian data residency guidelines.',
    ],
    clauses: [
      {
        heading: '1. What Data We Collect',
        content:
          'We collect your full name, email address, phone number, delivery addresses, and login credentials; responses to the Style Quiz used to compute your Style Vector; photos uploaded for AI condition-checking and listings; and interaction signals (views, saves, swaps, orders).',
        legalBasis: 'DPDP Act, 2023, Section 6 & DPDP Rules, 2025 (Notice itemizing specific data categories collected).',
      },
      {
        heading: '2. Purpose of Collection & Consent',
        content:
          'Data is processed solely to personalize fashion recommendations, run the AI condition scanner, facilitate peer-to-peer shipping and escrow, calculate environmental impact, and comply with tax and accounting rules. Processing relies on your informed consent, which you may withdraw at any time.',
        legalBasis: 'DPDP Act, 2023, Section 6(1) (Consent tied to explicit and lawful specified purposes).',
      },
      {
        heading: '3. Data Principal Rights (Access, Correction, Erasure)',
        content:
          'You may request a copy of your stored data, correct inaccurate details, or request full account deletion via your Profile Settings or by emailing our Data Protection contact. Deletion is completed within statutory timelines, subject only to mandatory legal retention (e.g. tax records).',
        legalBasis: 'DPDP Act, 2023, Sections 11–15 (Rights of Data Principal: Access, Correction, Erasure, Grievance Redressal).',
      },
      {
        heading: '4. Data Storage & Cross-Border Safeguards',
        content:
          'User databases and encrypted images are hosted on secure enterprise cloud infrastructure. When cross-border processing occurs for cloud infrastructure, it is performed in strict compliance with the Central Government’s notified cross-border data transfer framework.',
        legalBasis: 'DPDP Act, 2023, Section 16 (Cross-border data transfers).',
      },
    ],
  },
  {
    id: 'seller-terms',
    title: 'Seller Terms & Authenticity Policy',
    shortTitle: 'Seller Terms',
    icon: 'pricetag-outline',
    badge: 'TCS / TDS NOTIFIED',
    statutoryReference: 'Sale of Goods Act, 1930 • Trade Marks Act, 1999 • CGST Act, 2017 § 52 • Income Tax Act, 1961 § 194-O',
    quickTake: [
      'You must lawfully own every item you list and describe its condition and defects transparently.',
      'Counterfeits and replica goods are strictly prohibited and result in permanent platform ban.',
      'Mandatory statutory tax deductions (TCS and TDS) are deducted at source and remitted to the Government of India on your behalf.',
      'Seller payouts are disbursed following delivery confirmation and completion of the return window.',
    ],
    clauses: [
      {
        heading: '1. Lawful Ownership & Accurate Disclosures',
        content:
          'By listing any garment, you affirm that you have unencumbered ownership and the right to sell or transfer it. All photographs, brand attributions, sizing, fabric content, and physical defects must be accurately disclosed.',
        legalBasis: 'Sale of Goods Act, 1930 (Implied undertaking as to title and description).',
      },
      {
        heading: '2. Zero Tolerance for Counterfeit Items',
        content:
          'Listing counterfeit, knockoff, or trademark-infringing goods is strictly prohibited. Violations lead to immediate listing removal, forfeiture of pending payouts, account deactivation, and potential civil or criminal liability to brand trademark owners.',
        legalBasis: 'Trade Marks Act, 1999; Bharatiya Nyaya Sanhita, 2023 (Cheating & fraudulent imitation).',
      },
      {
        heading: '3. Statutory Tax Deductions (GST TCS & Income Tax TDS)',
        content:
          'As an electronic commerce operator, KaPhor is required by Indian law to deduct Tax Collected at Source (TCS) under Section 52 of the CGST Act, 2017 and Tax Deducted at Source (TDS) under Section 194-O of the Income Tax Act, 1961. Your payout receipts clearly itemize these remittances.',
        legalBasis: 'CGST Act, 2017, Section 52; Income Tax Act, 1961, Section 194-O.',
      },
    ],
  },
  {
    id: 'rental-terms',
    title: 'Rental & Bailment Terms',
    shortTitle: 'Rental Terms',
    icon: 'time-outline',
    badge: 'BAILMENT (SEC 148)',
    statutoryReference: 'Indian Contract Act, 1872 (Bailment, Sections 148–171) • Consumer Protection Act, 2019',
    quickTake: [
      'Rentals are legal bailments — the renter enjoys temporary possession while ownership remains with the lessor.',
      'A refundable security deposit is held during the rental period to guarantee safe and timely return.',
      'Normal wear is accepted; severe tears, deep stains, or failure to return incur repair or replacement deductions.',
      'Items must be shipped back in provided protective packaging on or before the agreed return date.',
    ],
    clauses: [
      {
        heading: '1. Nature of Rental (Contract of Bailment)',
        content:
          'A rental transaction on KaPhor constitutes a bailment under Section 148 of the Indian Contract Act, 1872. Ownership of the garment remains with the owner/lender at all times. The renter acquires temporary possession for the specified duration.',
        legalBasis: 'Indian Contract Act, 1872, Sections 148–171 (Law of Bailment).',
      },
      {
        heading: '2. Security Deposit & Inspection Protocol',
        content:
          'Renters provide a refundable security deposit prior to dispatch. Upon return delivery, the owner or designated fulfillment partner conducts condition verification. Deposits are refunded within 3–5 business days, minus documented cleaning or damage deductions.',
        legalBasis: 'Indian Contract Act, 1872, Section 151 (Bailee duty of reasonable care).',
      },
      {
        heading: '3. Damage, Late Fees & Loss Recovery',
        content:
          'Renters are responsible for returning items in the condition received, allowing for reasonable, non-destructive wear. Unreasonable delays incur standard daily late charges; non-returned garments will be billed at full replacement value.',
        legalBasis: 'Indian Contract Act, 1872, Section 161 (Bailee responsibility on delayed delivery).',
      },
    ],
  },
  {
    id: 'swap-agreement',
    title: 'Swapping Agreement & Barter Contract',
    shortTitle: 'Swap Terms',
    icon: 'repeat-outline',
    badge: 'BARTER CONTRACT',
    statutoryReference: 'Indian Contract Act, 1872 • Consumer Protection Act, 2019 • Information Technology Act, 2000 § 79',
    quickTake: [
      'A swap is a binding barter contract where two users mutually agree to exchange garments.',
      'Ownership of each garment transfers only upon mutual delivery confirmation by both parties.',
      'Both parties commit a ₹500 refundable escrow security deposit to guarantee dispatch within 3 business days.',
      'If an item arrives significantly not as described, users have 48 hours to open an unboxing dispute for mediation.',
    ],
    clauses: [
      {
        heading: '1. P2P Barter Contract & Mutual Ownership Transfer',
        content:
          'A swap is an exchange of movable property governed by general contract principles under the Indian Contract Act, 1872. Title and ownership of each swapped garment transfer between parties strictly upon mutual confirmation of delivery.',
        legalBasis: 'Indian Contract Act, 1872 (Barter contract under general contract law).',
      },
      {
        heading: '2. Escrow Security Deposit & Dispatch Commitment',
        content:
          'Both parties deposit an automated escrow guarantee (₹500) upon signing the swap agreement. Each party agrees to pack securely and dispatch the item with verifiable courier tracking within 3 business days. The deposit is automatically released upon delivery confirmation.',
        legalBasis: 'Indian Contract Act, 1872, Section 73 (Compensation for breach of contract).',
      },
      {
        heading: '3. Failed Swaps & Reverse Logistics',
        content:
          'If a swap fails after one party has dispatched (such as recipient non-fulfillment or cancellation), KaPhor coordinates reverse courier return of the dispatched garment and releases escrow funds to the compliant user.',
        legalBasis: 'Consumer Protection Act, 2019 (Protection from unfair practices in platform transactions).',
      },
      {
        heading: '4. 48-Hour Unboxing Dispute Window',
        content:
          'Users must record clear unboxing video/photos upon package arrival. Any claim for damaged, soiled, or materially misdescribed items must be filed within 48 hours of delivery for community mediation and escrow withholding.',
        legalBasis: 'Indian Evidence Act & Consumer Protection (E-Commerce) Rules, 2020.',
      },
      {
        heading: '5. Intermediary Platform Non-Liability',
        content:
          'KaPhor provides the matchmaking, messaging, and escrow software infrastructure under Section 79 of the IT Act, 2000. KaPhor is not a party to the barter contract and assumes no warranty or merchantability obligations regarding swapped garments.',
        legalBasis: 'Information Technology Act, 2000, Section 79.',
      },
    ],
  },
  {
    id: 'refund-policy',
    title: 'Refund, Return & Cancellation Policy',
    shortTitle: 'Refunds & Returns',
    icon: 'refresh-outline',
    badge: 'E-COMMERCE RULES 2020',
    statutoryReference: 'Consumer Protection (E-Commerce) Rules, 2020, Rule 5 • Consumer Protection Act, 2019',
    quickTake: [
      'Buyers may initiate a return within 48 hours of delivery if an item is materially misdescribed or damaged.',
      'Refunds are processed back to the original payment source within 5–7 banking business days of item receipt.',
      'Order cancellations are permissible prior to seller dispatch without penalty.',
      'Because KaPhor collects statutory TCS on completed transactions, tax adjustments may require standard settlement cycles.',
    ],
    clauses: [
      {
        heading: '1. Return Window for Misdescribed Goods',
        content:
          'Buyers are entitled to request returns within 48 hours of delivery if the received garment is defective, damaged in transit, counterfeit, or significantly different from listing photos and disclosures.',
        legalBasis: 'Consumer Protection (E-Commerce) Rules, 2020, Rule 5(3)(e).',
      },
      {
        heading: '2. Refund Processing Timelines',
        content:
          'Approved refunds are credited to the buyer’s original payment method within 5–7 business days following verified return delivery. For rental deposits, refunds are released within 3–5 business days of check-in inspection.',
        legalBasis: 'Consumer Protection Act, 2019; Payment Gateway Settlement Guidelines.',
      },
      {
        heading: '3. Tax Withholding Adjustments on Returns',
        content:
          'As KaPhor collects statutory TCS on marketplace orders, refunds on returned merchandise are reconciled against subsequent tax reporting cycles in accordance with GST compliance guidelines.',
        legalBasis: 'CGST Act, 2017, Section 52 (Tax Collected at Source return reconciliation).',
      },
    ],
  },
  {
    id: 'community-policy',
    title: 'Community, Content & Environmental Policy',
    shortTitle: 'Community & Green Claims',
    icon: 'leaf-outline',
    badge: 'CCPA 2024 GUIDELINES',
    statutoryReference: 'Copyright Act, 1957 • CCPA Guidelines for Prevention of Misleading Advertisement & Greenwashing, 2024',
    quickTake: [
      'You retain ownership of your uploaded photos, granting KaPhor a license to display them for listings and promotion.',
      'Respectful, harassment-free communication is strictly enforced across all direct messaging channels.',
      'Environmental metrics (water saved, carbon offset, trees equivalent) are modeled scientific estimates based on LCA textile benchmarks, not certified lab measurements.',
      'Greenwashing and deceptive environmental claims are strictly prohibited.',
    ],
    clauses: [
      {
        heading: '1. User Content & Intellectual Property License',
        content:
          'You retain full copyright in the photos and text you upload to KaPhor. By publishing a listing or review, you grant KaPhor a non-exclusive, royalty-free, worldwide license to display, crop, optimize, and feature your photos to facilitate marketplace discovery.',
        legalBasis: 'Copyright Act, 1957 (Platform license for user-generated content).',
      },
      {
        heading: '2. Environmental Impact Calculation Methodology Disclosure',
        content:
          'Figures shown on your Impact Dashboard (liters of water preserved, kg of CO₂ offset, landfill diversion weight) are modeled scientific estimates derived from published Life Cycle Assessment (LCA) textile benchmarks. They reflect circular reuse impact compared to virgin textile manufacturing and are not individual laboratory-certified measurements.',
        legalBasis: 'CCPA Guidelines for Prevention and Regulation of Greenwashing, 2024 (Mandatory disclosure of methodology for substantiating environmental claims).',
      },
      {
        heading: '3. Prohibited Greenwashing Claims',
        content:
          'Sellers and upcyclers must not make exaggerated or unsubstantiated eco-friendly claims (e.g. "100% carbon negative" or "chemically zero waste") without verifiable third-party certification.',
        legalBasis: 'Central Consumer Protection Authority (CCPA) Greenwashing Guidelines, 2024.',
      },
    ],
  },
  {
    id: 'grievance-policy',
    title: 'Grievance Redressal & Compliance Contacts',
    shortTitle: 'Grievance Redressal',
    icon: 'mail-outline',
    badge: 'RULE 3(2) IT RULES',
    statutoryReference: 'IT (Intermediary Guidelines) Rules, 2021, Rule 3(2) • Consumer Protection Act, 2019 • DPDP Act, 2023',
    quickTake: [
      'Designated Grievance Officer: Insiyah Bhatia, Legal & Compliance Lead.',
      'Email: grievance@kaphor.com • Address: KaPhor Circular Hub, Mumbai, MH, India.',
      'All user complaints are acknowledged within 24 hours and fully resolved within 15 days (or 72 hours for unlawful content takedowns).',
      'Users may escalate unresolved consumer complaints to the National Consumer Helpline or the Data Protection Board of India.',
    ],
    clauses: [
      {
        heading: '1. Statutory Grievance Officer Contact Details',
        content:
          'In accordance with Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the Consumer Protection (E-Commerce) Rules, 2020, our Grievance Officer details are:\n\n• Name: Insiyah Bhatia\n• Designation: Grievance Officer & Data Protection Lead\n• Email: grievance@kaphor.com / legal@kaphor.com\n• Operational Address: KaPhor Circular Fashion Hub, Mumbai, Maharashtra 400001, India.',
        legalBasis: 'Information Technology (Intermediary Guidelines) Rules, 2021, Rule 3(2).',
      },
      {
        heading: '2. Mandatory Response Timelines',
        content:
          'The Grievance Officer shall acknowledge receipt of any complaint within 24 (twenty-four) hours and redress the grievance within 15 (fifteen) days from receipt. Requests for removal of unlawful content under Rule 3(1)(d) shall be acted upon within 72 (seventy-two) hours.',
        legalBasis: 'IT Rules, 2021, Rule 3(2); Consumer Protection (E-Commerce) Rules, 2020.',
      },
      {
        heading: '3. Statutory Escalation Pathways',
        content:
          'If you remain unsatisfied with the internal grievance resolution, you retain the legal right to escalate complaints to:\n\n• Consumer Disputes: National Consumer Helpline (1915) or the State Consumer Disputes Redressal Commission.\n• Data Privacy: The Data Protection Board of India under Section 18 of the DPDP Act, 2023.\n• Intellectual Property: Appropriate civil courts in Mumbai, India.',
        legalBasis: 'Consumer Protection Act, 2019; Digital Personal Data Protection Act, 2023, Section 18.',
      },
    ],
  },
];

/**
 * High-level Swap Protections (Key Pillars) used for streamlined, professional swap checkout
 */
export const KEY_SWAP_PROTECTIONS = [
  {
    icon: 'shield-checkmark',
    title: 'Automated Escrow Deposit',
    summary: '₹500 refundable security deposit held in automated escrow until both parties confirm receipt.',
  },
  {
    icon: 'repeat',
    title: 'Mutual Ownership Transfer',
    summary: 'Binding barter contract under Indian Contract Act — ownership transfers upon mutual delivery confirmation.',
  },
  {
    icon: 'sparkles',
    title: 'Authenticity & Disclosure',
    summary: 'Both swappers warrant that garments strictly match listing photos, condition, and fiber specifications.',
  },
  {
    icon: 'scale',
    title: 'Intermediary Safe Harbour',
    summary: 'P2P exchange facilitated under Sec 79 IT Act, backed by a 48-hour unboxing dispute mediation window.',
  },
];
