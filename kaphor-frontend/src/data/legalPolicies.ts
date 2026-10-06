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
    title: 'Terms & Conditions',
    shortTitle: 'Terms of Use',
    icon: 'document-text-outline',
    badge: 'IT ACT 2000 § 79',
    statutoryReference: 'Information Technology Act, 2000 • IT (Intermediary Guidelines) Rules, 2021 • Consumer Protection Act, 2019 • Indian Contract Act, 1872',
    quickTake: [
      'These terms form a binding contract between you and KaPhor when you register, list, buy, sell, rent, or swap on the Platform.',
      'KaPhor is an electronic intermediary under Section 79 of the IT Act — listings and transactions are direct, peer-to-peer agreements between users.',
      'Payments and held funds run through RBI-authorized payment aggregators; KaPhor never stores card or banking credentials.',
      'Disputes are resolved through our Grievance Officer and, where not resolved, through arbitration or competent consumer forums — preserving all your statutory rights.',
    ],
    clauses: [
      {
        heading: '1. Acceptance of These Terms',
        content:
          'By accessing, registering, or using the KaPhor application and services (the "Platform"), you agree to be bound by these Terms & Conditions, our Privacy Policy, and all supplemental policies (Seller, Rental, Swap, Refund, and Community policies). If you do not agree, you must not use the Platform. These Terms constitute a binding contract between you and KaPhor, operated by KaPhor Circular Fashion Hub, Mumbai, India.',
        legalBasis: 'Indian Contract Act, 1872, Sections 2(h) and 10 (agreement and consideration); Information Technology Act, 2000.',
      },
      {
        heading: '2. Eligibility & Capacity',
        content:
          'You must be at least 18 years of age and legally competent to contract under Indian law to register or transact on KaPhor. By creating an account, you warrant that all information provided is accurate and truthful, and that you are authorised to bind any entity on whose behalf you transact.',
        legalBasis: 'Indian Contract Act, 1872 (capacity to contract); DPDP Act, 2023, Section 9 (age verification).',
      },
      {
        heading: '3. Account Registration & Security',
        content:
          'You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You agree to notify us immediately of any unauthorised use. KaPhor may suspend or close accounts that breach these Terms, and you may request closure at any time from Profile Settings.',
        legalBasis: 'Information Technology (Intermediary Guidelines) Rules, 2021, Rule 3 (user due-diligence).',
      },
      {
        heading: '4. Platform Role & Intermediary Status',
        content:
          'KaPhor is an electronic marketplace and communications facilitator under Section 79 of the Information Technology Act, 2000. We do not manufacture items, hold title to traded goods, or warrant merchantability. Every sale, rental, and swap is a direct, private agreement between the transacting users; KaPhor provides the matching, communication, secure payment, and logistics software infrastructure that connects them.',
        legalBasis: 'Information Technology Act, 2000, Section 79 (intermediary safe harbour, conditional on due diligence).',
      },
      {
        heading: '5. Listings & Content Standards',
        content:
          'All listings must accurately represent the item offered, including brand, size, fabric, condition, and any defects. Listing content must comply with the Community Policy, must not infringe third-party rights, and must not contain unlawful material. KaPhor reserves the right to reject, unpublish, or remove any listing that violates these Terms.',
        legalBasis: 'Information Technology Rules, 2021, Rule 3(1)(d); Consumer Protection (E-Commerce) Rules, 2020, Rule 4.',
      },
      {
        heading: '6. Payments, Held Funds & Payouts',
        content:
          'All payments are processed through RBI-authorized payment aggregators such as Razorpay. KaPhor does not collect or retain card or banking credentials. Seller, rental, and swap proceeds are held in secure settlement accounts and disbursed after delivery verification and the expiry of the applicable return window.',
        legalBasis: 'Payment and Settlement Systems Act, 2007; RBI Master Directions on Payment Aggregators and Gateways.',
      },
      {
        heading: '7. Fees, Taxes & Statutory Deductions',
        content:
          'Use of the Platform may attract service fees, disclosed before you confirm each transaction. KaPhor is statutorily required to deduct Tax Collected at Source (TCS) under Section 52 of the CGST Act, 2017 and Tax Deducted at Source (TDS) under Section 194-O of the Income Tax Act, 1961; these amounts are itemised in your transaction and payout receipts.',
        legalBasis: 'CGST Act, 2017, Section 52; Income Tax Act, 1961, Section 194-O.',
      },
      {
        heading: '8. Prohibited Conduct',
        content:
          'Users may not list counterfeit or stolen goods, hazardous materials, or unlawful items, may not infringe intellectual property, and may not engage in harassment, fraud, manipulation, or circumvention of Platform controls. Violations may result in suspension, permanent ban, forfeiture of pending payouts, and referral to law enforcement.',
        legalBasis: 'Trade Marks Act, 1999; Bharatiya Nyaya Sanhita, 2023; Information Technology Rules, 2021, Rule 3(1)(b)–(d).',
      },
      {
        heading: '9. Intellectual Property & User Content Licence',
        content:
          'You retain ownership of the content you upload to KaPhor. By publishing a listing, review, or message, you grant KaPhor a non-exclusive, royalty-free, worldwide, sublicensable licence to host, display, crop, optimise, and feature that content for the operation of the Platform and its features.',
        legalBasis: 'Copyright Act, 1957, Section 14 (rights of reproduction and communication).',
      },
      {
        heading: '10. Disclaimers & Limitation of Liability',
        content:
          'To the maximum extent permitted by law, KaPhor provides the Platform on an "as is" and "as available" basis and disclaims implied warranties of merchantability and fitness for a particular purpose. KaPhor is not liable for direct or indirect losses arising from user-to-user transactions, and liability is limited to the aggregate fees paid in the transaction giving rise to the claim. Nothing in these Terms excludes or limits any statutory right you cannot waive, including rights under the Consumer Protection Act, 2019.',
        legalBasis: 'Consumer Protection Act, 2019; Consumer Protection (E-Commerce) Rules, 2020, Rule 6 (liability of marketplace e-commerce entity).',
      },
      {
        heading: '11. Suspension & Termination',
        content:
          'KaPhor may suspend or terminate your access for breach of these Terms, suspected fraud, or criminal activity, and may withhold settlement pending resolution. You may terminate your relationship at any time by deleting your account in accordance with our Privacy Policy. Provisions that survive termination include payments, taxes, dispute resolution, and the content licence.',
        legalBasis: 'Indian Contract Act, 1872, Section 39; Information Technology Act, 2000, Section 79.',
      },
      {
        heading: '12. Dispute Resolution, Governing Law & Jurisdiction',
        content:
          'These Terms are governed by the laws of the Republic of India. Users agree to first seek informal resolution through our designated Grievance Officer. Unresolved disputes may be referred to arbitration in Mumbai under the Arbitration and Conciliation Act, 1996. Nothing herein restricts a consumer from approaching a competent Consumer Commission under the Consumer Protection Act, 2019.',
        legalBasis: 'Arbitration and Conciliation Act, 1996; Consumer Protection Act, 2019.',
      },
      {
        heading: '13. Notices & Amendments',
        content:
          'Material changes to these Terms will be notified in-app and by email and will apply prospectively. Official communications are sent to your registered email address or as in-app notifications and are deemed received on the following business day.',
        legalBasis: 'Information Technology Act, 2000, Section 4 (electronic records); Information Technology Rules, 2021.',
      },
      {
        heading: '14. Grievance & Contact',
        content:
          'For any question about these Terms, contact our designated Grievance Officer at grievance@kaphor.com or the Data Protection contact at privacy@kaphor.com, KaPhor Circular Fashion Hub, Mumbai, Maharashtra 400001, India.',
        legalBasis: 'Information Technology (Intermediary Guidelines) Rules, 2021, Rule 3(2).',
      },
    ],
  },
  {
    id: 'privacy-policy',
    title: 'Privacy Policy & Data Protection Notice',
    shortTitle: 'Privacy Policy',
    icon: 'shield-checkmark-outline',
    badge: 'DPDP ACT 2023',
    statutoryReference: 'Digital Personal Data Protection Act, 2023 & DPDP Rules 2025 • Information Technology Act, 2000 • Consumer Protection Act, 2019',
    quickTake: [
      'We collect only the minimum personal data necessary for the marketplace, secure payments, AI condition checks, and impact tracking to function.',
      'Your data is never sold or shared with data brokers or advertisers — it is disclosed only to regulated processors who need it to deliver the service.',
      'You can withdraw consent, access, correct, or erase your data, and delete your account, directly from within the app at any time.',
      'All storage and transfers comply with the DPDP Act 2023; credentials are stored as one-way cryptographic hashes and traffic is encrypted end-to-end.',
    ],
    clauses: [
      {
        heading: '1. Introduction, Data Controller & Scope',
        content:
          'KaPhor (the "Platform"), operated by KaPhor Circular Fashion Hub, Mumbai, India, acts as the Data Fiduciary for personal data processed through the KaPhor mobile application and related services. This Privacy Policy & Data Protection Notice explains, in clear and plain language: the categories of personal data we collect, the purposes of processing, the lawful grounds relied upon, the third parties that process data on our behalf, the periods for which data is retained, and how you may exercise your statutory rights as a Data Principal under the Digital Personal Data Protection Act, 2023.',
        legalBasis: 'DPDP Act, 2023, Section 8 (general obligations of Data Fiduciary) and Section 15 (duties of Data Principal); DPDP Rules, 2025.',
      },
      {
        heading: '2. Personal Data We Collect',
        content:
          'We collect only such personal data as is necessary for the specified purposes, itemised below:\n\n• Account & identity data — name, verified phone number, email address, login credentials (stored solely as a one-way cryptographic hash), and, if you register through Google Sign-In, your Google profile information.\n\n• Profile & style data — avatar or photo, city, style quiz responses, and the derived Style Vector used for discovery and recommendations.\n\n• Garment & listing data — photographs, descriptions, brand, size, fabric content, condition notes, and AI condition-check scans that you upload.\n\n• Transaction data — order, rental, swap, secure payment, payout and refund details, together with the delivery address and logistics partner details required to fulfil them.\n\n• Usage data — searches performed, listings viewed, saved or wishlisted, swap interactions, and other in-app behaviour signals.\n\n• Device & technical data — device model, operating system, app version, IP address, and push-notification tokens.\n\n• Support & correspondence data — the contents of any communication you send to us.\n\nWe do not collect precise real-time GPS location, contact lists, call logs, or health information.',
        legalBasis: 'DPDP Act, 2023, Section 5 (notice itemising specific categories of personal data and purposes); DPDP Rules, 2025, Rule 3; aligned to Apple App Privacy and Google Play Data Safety data-type inventories.',
      },
      {
        heading: '3. How We Collect Data',
        content:
          'Personal data is collected in three ways: (i) directly from you when you create an account, complete the style quiz, upload garments, transact, or contact support; (ii) automatically as you use the app, through usage events, device and diagnostic information, and push-notification registration; and (iii) from regulated third parties you authorise, such as Google (sign-in profile) and our payment aggregators (transaction confirmations only — never card or banking credentials).',
        legalBasis: 'DPDP Act, 2023, Section 5; Information Technology (Intermediary Guidelines) Rules, 2021.',
      },
      {
        heading: '4. Purposes of Processing',
        content:
          'We process personal data solely for lawful, specified purposes, including: (i) creating and maintaining your account and enabling buying, selling, renting, and swapping; (ii) verifying eligibility (a minimum age of 18 years) and safeguarding the community; (iii) personalising discovery and recommendations through your Style Vector and behaviour signals; (iv) running the AI condition and fiber assessment (the "AI Scan") to route garments towards resale, repair, or certified recycling; (v) estimating environmental impact for your Impact Record; (vi) processing payments, secure settlements, statutory taxes (TCS/TDS), and refunds; (vii) delivering transactional, notification, and customer-service communications; and (viii) detecting fraud and meeting legal obligations.',
        legalBasis: 'DPDP Act, 2023, Sections 4 and 6; Payment and Settlement Systems Act, 2007; CGST Act, 2017, Section 52.',
      },
      {
        heading: '5. Legal Basis & Consent',
        content:
          'Our processing relies on your free, specific, informed, unconditional and unambiguous consent given through a clear affirmative action, or on a legitimate use recognised by the Act, such as fulfilling a transaction you requested or complying with law. You may withdraw consent at any time with the same ease with which it was given. Withdrawal does not affect the lawfulness of processing that occurred before withdrawal, and data necessary to complete an order already placed will continue to be processed solely to fulfil that order.',
        legalBasis: 'DPDP Act, 2023, Sections 4, 6, and 7.',
      },
      {
        heading: '6. AI, Automated Processing & Profiling',
        content:
          'KaPhor uses AI models, including a Gemini-powered multimodal assessment, to analyse uploaded garment photographs for fiber type and condition, to score circularity, to match garments to repair guides and recycling routes, and to generate personalised recommendations from your Style Vector. These outputs are advisory and are surfaced with transparency; we do not take decisions with legal or similarly significant effect on you (such as creditworthiness) solely by automated means. You may always request human review of an AI route outcome by contacting our Grievance Officer.',
        legalBasis: 'DPDP Act, 2023, Sections 4–6 (notice and consent for AI-assisted processing); Information Technology Rules, 2021; CCPA Guidelines for Prevention of Misleading Advertisements and Greenwashing, 2024.',
      },
      {
        heading: '7. Sharing & Third-Party Processors',
        content:
          'We never sell, rent, or trade your personal data and do not share it with data brokers or advertisers. Data is disclosed only to carefully selected processors that act strictly on our instructions and under written data-processing terms, including: payment aggregators (Razorpay) for transaction processing; media and object storage providers (Cloudinary, Amazon S3) for hosting images and uploads; Firebase Cloud Messaging for push notifications; and cloud infrastructure providers hosting our servers. Data may also be disclosed when required by Indian law, a court order, or a lawful government request.',
        legalBasis: 'DPDP Act, 2023, Section 11(1)(b) (identities of Data Fiduciaries and Processors with whom data is shared); Section 8(5) (information on storage and transfer); RBI directions on Payment Aggregators.',
      },
      {
        heading: '8. Data Retention & Storage Limitation',
        content:
          'Personal data is retained only for as long as necessary for the purpose for which it was collected. Account-related data is retained while your account is active and erased within 30 days of account deletion; transaction, tax, and payment records are retained for the statutory periods under the Income Tax Act, 1961 and the CGST Act, 2017 (typically up to seven years); aggregated and anonymised analytics may be retained indefinitely. On expiry of each retention period, data is deleted or irreversibly anonymised.',
        legalBasis: 'DPDP Act, 2023, Section 8 (storage limitation); Income Tax Act, 1961; CGST Act, 2017.',
      },
      {
        heading: '9. Data Security Safeguards',
        content:
          'We implement reasonable technical and organisational measures to protect personal data, including encryption in transit (TLS) and at rest, one-way cryptographic hashing of credentials (Argon2), least-privilege access controls, and security review of all processors. In the event of a personal data breach, we will notify affected Data Principals and the Data Protection Board of India in the manner and within the timelines prescribed under the DPDP Rules, 2025.',
        legalBasis: 'DPDP Act, 2023, Section 8 (reasonable security safeguards and breach notification); DPDP Rules, 2025.',
      },
      {
        heading: '10. Cross-Border Data Transfers',
        content:
          'Where our processors or cloud infrastructure are located outside India, any transfer or storage is performed only in compliance with the Central Government notified cross-border data transfer framework under Section 16 of the DPDP Act and is subject to contractual safeguards that preserve a level of protection equivalent to that described in this Policy.',
        legalBasis: 'DPDP Act, 2023, Section 16 (processing of personal data outside India).',
      },
      {
        heading: '11. Children’s Privacy',
        content:
          'The Platform is strictly intended for persons who have attained the age of 18 years. We do not knowingly collect, use, or disclose the personal data of any person below the age of 18. If you believe that the personal data of a minor has been provided to us, contact our Grievance Officer and we will erase such data as soon as practicable.',
        legalBasis: 'DPDP Act, 2023, Section 9 (processing of children personal data); Indian Contract Act, 1872 (capacity to contract).',
      },
      {
        heading: '12. Device Permissions, Camera, Photo Library & Push Notifications',
        content:
          'To upload garment photographs or run the AI condition scan, we request access to your camera and/or photo library; images are transmitted to our servers only when you choose to upload or scan them. We send transactional and promotional push notifications through Firebase Cloud Messaging; you may disable them at any time from your device settings without affecting core functionality.',
        legalBasis: 'Apple App Review Guidelines 5.1 and App Privacy; Google Play User Data and Data Safety policies; DPDP Act, 2023, Sections 5–6.',
      },
      {
        heading: '13. Your Rights as a Data Principal',
        content:
          'Under the DPDP Act you have the right to: (i) obtain a summary of the personal data we process and the identities of parties with whom it is shared (Section 11); (ii) request correction, completion, or updating of inaccurate or misleading data (Section 12); (iii) request erasure of your personal data (Section 12), unless retention remains necessary for the specified purpose or by law; (iv) register grievances for redressal (Section 13); (v) nominate an individual to exercise your rights in the event of your death or incapacity (Section 14); and (vi) withdraw consent at any time (Section 6(4)). To exercise these rights, use the data and privacy controls under Profile Settings or email our Data Protection contact; we respond within the period prescribed under the DPDP Rules, 2025.',
        legalBasis: 'DPDP Act, 2023, Sections 6(4), 11, 12, 13, 14, and 15; DPDP Rules, 2025, Rule 8.',
      },
      {
        heading: '14. Account Deletion',
        content:
          'You may delete your account and associated data directly from Profile Settings within the app, or by contacting us. On receiving a deletion request, we erase your personal data unless retention is required by law or is needed to complete a transaction in progress, in which case we inform you of the specific data and the period for which it must be retained. Deleting your account does not automatically terminate a live order, rental, swap, or escrow in progress.',
        legalBasis: 'Apple App Review Guideline 5.1.1(v) (in-app account deletion); Google Play User Data policy (account deletion); DPDP Act, 2023, Section 12(3).',
      },
      {
        heading: '15. Changes to This Policy',
        content:
          'We may update this Privacy Policy from time to time to reflect changes in our services, data practices, or applicable law. Material changes will be notified to you in-app and by email, and the revised Policy will carry a new effective date and apply prospectively. Your continued use of the Platform after a material change constitutes acceptance of the updated Policy.',
        legalBasis: 'DPDP Act, 2023, Section 5 (notice); Information Technology Rules, 2021.',
      },
      {
        heading: '16. Contact Us & Data Protection Inquiries',
        content:
          'For any question about this Policy, to exercise your rights, or to report a suspected breach, contact our Data Protection contact at privacy@kaphor.com or write to KaPhor Circular Fashion Hub, Mumbai, Maharashtra 400001, India. Complaints may also be raised with our designated Grievance Officer under the grievance redressal procedures, and unresolved data-protection disputes may be escalated to the Data Protection Board of India under Section 18 of the DPDP Act, 2023.',
        legalBasis: 'DPDP Act, 2023, Sections 13 and 18; Information Technology (Intermediary Guidelines) Rules, 2021, Rule 3(2).',
      },
    ],
  },
  {
    id: 'seller-terms',
    title: 'Seller Terms & Authenticity Policy',
    shortTitle: 'Seller Terms',
    icon: 'pricetag-outline',
    badge: 'TCS / TDS NOTIFIED',
    statutoryReference: 'Sale of Goods Act, 1930 • Trade Marks Act, 1999 • CGST Act, 2017, Section 52 • Income Tax Act, 1961, Section 194-O • Consumer Protection Act, 2019',
    quickTake: [
      'You must lawfully own every item you list and disclose its condition and defects fully and truthfully.',
      'Counterfeits and replica goods are strictly prohibited and result in a permanent platform ban and forfeiture of pending payouts.',
      'Statutory tax deductions (TCS under CGST and TDS under Income Tax) are deducted at source and remitted to the Government of India on your behalf.',
      'Payouts are disbursed after delivery confirmation and the return window closes, typically within 5–7 business days.',
    ],
    clauses: [
      {
        heading: '1. Seller Eligibility',
        content:
          'Only registered users who have attained 18 years of age and hold valid payout details may list items for sale. By listing, you certify your identity and confirm that the payout account details provided are accurate and belong to you.',
        legalBasis: 'Indian Contract Act, 1872 (capacity); DPDP Act, 2023, Section 9.',
      },
      {
        heading: '2. Title & Lawful Ownership',
        content:
          'You affirm that you hold unencumbered, rightful ownership of every item you list and the legal authority to transfer title on sale. Items must not be stolen, subject to third-party rights, or subject to any unreleased security or lien.',
        legalBasis: 'Sale of Goods Act, 1930, Section 14 (implied undertaking as to title).',
      },
      {
        heading: '3. Accurate Listing Disclosures',
        content:
          'Photographs, brand attribution, sizing, fabric content, condition, and all material defects must be accurately disclosed. Where a return results from your misdescription, you bear the return logistics cost and any resulting escrow deduction.',
        legalBasis: 'Sale of Goods Act, 1930; Consumer Protection (E-Commerce) Rules, 2020, Rule 6.',
      },
      {
        heading: '4. Zero Tolerance for Counterfeits',
        content:
          'Listing counterfeit, knockoff, or trademark-infringing goods is strictly prohibited and constitutes a material breach. Consequences include immediate removal of the listing, forfeiture of pending payouts, permanent account deactivation, and potential civil or criminal liability to brand owners.',
        legalBasis: 'Trade Marks Act, 1999; Bharatiya Nyaya Sanhita, 2023 (cheating and fraudulent imitation).',
      },
      {
        heading: '5. Pricing, Fees & Payout Schedule',
        content:
          'You set the sale price subject to the Platform fee rules disclosed at listing. Net proceeds, after fees and statutory deductions, are held safely and paid out to your linked payout account within 5–7 business days following delivery confirmation and the expiry of the return window.',
        legalBasis: 'Payment and Settlement Systems Act, 2007; RBI directions applicable to payment aggregators.',
      },
      {
        heading: '6. Statutory Tax Deductions',
        content:
          'As an electronic commerce operator, KaPhor deducts Tax Collected at Source (TCS) under Section 52 of the CGST Act, 2017 and Tax Deducted at Source (TDS) under Section 194-O of the Income Tax Act, 1961, and remits them to the Government of India. Your payout receipts itemise these remittances, and you are responsible for reflecting them in your tax filings.',
        legalBasis: 'CGST Act, 2017, Section 52; Income Tax Act, 1961, Section 194-O.',
      },
      {
        heading: '7. Shipping & Delivery',
        content:
          'Sellers must ship items securely within the timeline stated in the listing using verifiable delivery tracking as required by the transaction flow. Orders not shipped within the stated window may be cancelled automatically, with held funds returned to the buyer.',
        legalBasis: 'Consumer Protection (E-Commerce) Rules, 2020; Sale of Goods Act, 1930.',
      },
      {
        heading: '8. Returns, Refunds & Chargebacks',
        content:
          'Approved returns under the Refund Policy are deducted from your held balance. Where a dispute determines that a sale was materially misdescribed, the buyer is refunded, return logistics are charged to you, and repeat violations attract enforcement action.',
        legalBasis: 'Consumer Protection Act, 2019; Consumer Protection (E-Commerce) Rules, 2020, Rule 5.',
      },
      {
        heading: '9. Prohibited Listings & Enforcement',
        content:
          'Items prohibited by law or Platform policy (including counterfeit goods, hazardous materials, and articles breaching these Terms) are removed immediately. Serious or repeated violations lead to suspension of payouts, permanent ban, and referral to law enforcement.',
        legalBasis: 'Information Technology Rules, 2021, Rule 3(1)(d); Bharatiya Nyaya Sanhita, 2023.',
      },
      {
        heading: '10. Seller Account Termination',
        content:
          'KaPhor may terminate a seller account for breach of these Terms. Upon lawful termination, you remain liable for completed transactions, statutory reporting, and any amounts due to buyers or the Platform.',
        legalBasis: 'Indian Contract Act, 1872; CGST Act, 2017, Section 52.',
      },
    ],
  },
  {
    id: 'rental-terms',
    title: 'Rental & Bailment Terms',
    shortTitle: 'Rental Terms',
    icon: 'time-outline',
    badge: 'BAILMENT (SEC 148)',
    statutoryReference: 'Indian Contract Act, 1872 (Bailment, Sections 148–171) • Consumer Protection Act, 2019 • Information Technology Act, 2000',
    quickTake: [
      'Rentals are legal bailments under the Indian Contract Act — the renter holds temporary possession while ownership remains with the owner.',
      'A refundable security deposit is held for the rental period and released after a documented condition inspection.',
      'Normal wear is accepted; severe damage, deep stains, or loss incur documented deductions or replacement charges.',
      'Items must be returned in the provided protective packaging on or before the agreed return date.',
    ],
    clauses: [
      {
        heading: '1. Nature of the Rental Agreement (Contract of Bailment)',
        content:
          'A rental on KaPhor constitutes a contract of bailment under Section 148 of the Indian Contract Act, 1872. The owner (bailor) delivers the garment to the renter (bailee) for temporary possession and use; ownership remains with the owner at all times.',
        legalBasis: 'Indian Contract Act, 1872, Sections 148–171 (law of bailment).',
      },
      {
        heading: '2. Rental Period, Pricing & Return Date',
        content:
          'The rental period, rental fee, and return date are stated in the booking confirmation. The rental starts when the item is shipped and ends on the agreed return date. Extensions are subject to owner approval and additional charges.',
        legalBasis: 'Indian Contract Act, 1872, Sections 148 and 163.',
      },
      {
        heading: '3. Security Deposit & Inspection',
        content:
          'Renters provide a refundable security deposit before shipping. On return, the owner or a designated fulfilment partner performs a condition inspection. The deposit is refunded within 3–5 business days, minus documented cleaning, repair, or late-return deductions.',
        legalBasis: 'Indian Contract Act, 1872, Section 151 (bailee duty of reasonable care).',
      },
      {
        heading: '4. Care & Obligations During Use',
        content:
          'The renter must exercise reasonable care, keep the garment clean and undamaged, and use it only for its intended purpose. Re-dyeing, substantial alteration, cleaning methods that risk damage, and unauthorised further lending or pledging are prohibited.',
        legalBasis: 'Indian Contract Act, 1872, Sections 151–152.',
      },
      {
        heading: '5. Damage, Late Fees & Loss',
        content:
          'Renters are liable for damage beyond reasonable, non-destructive wear; for unreasonable delay, standard daily late charges apply; and non-returned or lost garments are billed at the full replacement value disclosed at booking.',
        legalBasis: 'Indian Contract Act, 1872, Section 161 (bailee responsibility on delayed or unreturned goods).',
      },
      {
        heading: '6. Return & Reverse Logistics',
        content:
          'Items must be returned in the provided protective packaging on or before the return date using the label and instructions provided. Returns shipped after the return date remain the renter risk until delivery confirmation.',
        legalBasis: 'Indian Contract Act, 1872, Section 161.',
      },
      {
        heading: '7. Prohibited Use & Sub-Rental',
        content:
          'Rented items may not be sub-let, re-rented, pledged, gifted, or otherwise disposed of. Any such act constitutes a breach of the bailment and entitles the owner to recover the garment or its full replacement value.',
        legalBasis: 'Indian Contract Act, 1872, Section 154 (unauthorised act of bailee).',
      },
      {
        heading: '8. Limitation of Platform Liability',
        content:
          'KaPhor provides the rental matching, secure deposit, and communications infrastructure under Section 79 of the Information Technology Act, 2000 and is not a party to the bailment. Liability between owner and renter is governed by the bailment provisions set out above.',
        legalBasis: 'Information Technology Act, 2000, Section 79; Consumer Protection Act, 2019.',
      },
    ],
  },
  {
    id: 'swap-agreement',
    title: 'Swapping Agreement & Barter Contract',
    shortTitle: 'Swap Terms',
    icon: 'repeat-outline',
    badge: 'BARTER CONTRACT',
    statutoryReference: 'Indian Contract Act, 1872 • Consumer Protection Act, 2019 • Information Technology Act, 2000, Section 79',
    quickTake: [
      'A swap is a binding barter contract in which two users mutually agree to exchange garments.',
      'Title to each garment transfers strictly upon mutual delivery confirmation by both parties.',
      'Both parties commit a ₹500 refundable secure deposit to guarantee shipping within 3 business days.',
      'Items that arrive significantly not as described may be disputed within 48 hours of delivery.',
    ],
    clauses: [
      {
        heading: '1. Formation of the Barter Contract',
        content:
          'Accepting a swap creates a binding barter contract under general principles of the Indian Contract Act, 1872 for the exchange of the two nominated garments. Both parties must be eligible users who have attained the age of 18 years.',
        legalBasis: 'Indian Contract Act, 1872 (barter contract under general contract law).',
      },
      {
        heading: '2. Mutual Ownership Transfer',
        content:
          'Title and ownership of each garment transfer between the parties strictly upon mutual confirmation of delivery by both sides. Until then, each party remains the owner of the garment they hold.',
        legalBasis: 'Sale of Goods Act, 1930, Section 22 (transfer of title by agreement); Indian Contract Act, 1872.',
      },
      {
        heading: '3. Secure Deposit',
        content:
          'Both parties pledge a ₹500 refundable secure deposit upon signing the swap agreement. The deposit guarantees that each side ships its garment and is automatically released to both parties upon mutual delivery confirmation.',
        legalBasis: 'Indian Contract Act, 1872, Section 73 (compensation for breach of contract).',
      },
      {
        heading: '4. Shipping Promise',
        content:
          'Each party must pack its garment securely and ship it with verifiable delivery tracking within 3 business days of the agreement. Failure to ship results in cancellation of the swap and release of held funds to the compliant user.',
        legalBasis: 'Indian Contract Act, 1872, Sections 73 and 74 (compensation and reasonable pre-estimate of loss).',
      },
      {
        heading: '5. Condition Representations',
        content:
          'Each party warrants that its garment matches the listing photographs, size, fiber, and condition disclosures. Garments that are materially misdescribed or carry undisclosed damage may be rejected under the dispute window below.',
        legalBasis: 'Sale of Goods Act, 1930; Consumer Protection Act, 2019.',
      },
      {
        heading: '6. 48-Hour Unboxing & Dispute Window',
        content:
          'You must record clear unboxing video or photographs on arrival, and any claim for damage, soiling, or material misdescription must be filed within 48 hours of delivery. Claims are mediated by the Platform with held funds withheld pending resolution.',
        legalBasis: 'Consumer Protection (E-Commerce) Rules, 2020; Indian Evidence Act, 1872.',
      },
      {
        heading: '7. Failed Swaps & Reverse Logistics',
        content:
          'If a swap fails after one party has shipped (such as recipient non-fulfilment, cancellation, or an unresolved dispute), KaPhor coordinates a return delivery of the shipped garment and releases held funds to the compliant user.',
        legalBasis: 'Consumer Protection Act, 2019 (protection from unfair practices in platform transactions).',
      },
      {
        heading: '8. Intermediary Non-Liability',
        content:
          'KaPhor provides the matchmaking, messaging, and secure payment software infrastructure under Section 79 of the Information Technology Act, 2000 and is not a party to the barter contract. KaPhor assumes no warranty or merchantability obligation regarding swapped garments.',
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
    statutoryReference: 'Consumer Protection (E-Commerce) Rules, 2020, Rule 5 • Consumer Protection Act, 2019 • CGST Act, 2017, Section 52',
    quickTake: [
      'You may start a return within 48 hours of delivery if an item is materially misdescribed, defective, or significantly different from its listing.',
      'Refunds are returned to the original payment source within 5–7 banking business days of approved return receipt.',
      'Orders may be cancelled without penalty at any time before the seller ships the item.',
      'Because statutory TCS is collected on completed transactions, return-related tax adjustments follow the standard GST settlement cycle.',
    ],
    clauses: [
      {
        heading: '1. Return Eligibility',
        content:
          'A return entitles you to a refund only where the item is materially misdescribed, defective, damaged in transit, counterfeit, or significantly different from the listing photographs and disclosures. Instances of buyer remorse do not constitute a valid return ground.',
        legalBasis: 'Consumer Protection (E-Commerce) Rules, 2020, Rule 5(3).',
      },
      {
        heading: '2. Return Window & Evidence',
        content:
          'Return requests must be raised within 48 hours of delivery, accompanied by unboxing photographs or video that clearly show the item and its condition on arrival. Timely documentary evidence is essential for a prompt resolution.',
        legalBasis: 'Consumer Protection (E-Commerce) Rules, 2020, Rule 6.',
      },
      {
        heading: '3. How to Start a Return',
        content:
          'Navigate to your Order History, open the completed order, and select Request Return, choosing the return reason and uploading evidence. You will receive a return label and shipping instructions after the request is auto-approved, and funds remain held safely until resolution.',
        legalBasis: 'Consumer Protection Act, 2019; Consumer Protection (E-Commerce) Rules, 2020, Rule 5.',
      },
      {
        heading: '4. Refund Processing Timelines',
        content:
          'Approved refunds are credited to your original payment method within 5–7 business days of verified return delivery. Rental security deposits are released within 3–5 business days of the post-return condition inspection, minus documented deductions.',
        legalBasis: 'Consumer Protection Act, 2019; payment settlement guidelines applicable to the payment gateway.',
      },
      {
        heading: '5. Cancellation Policy',
        content:
          'You may cancel an order without any penalty up until the seller ships the item. After shipping, cancellation is governed by the return process above, and a request after delivery requires valid return grounds as set out in clause 1.',
        legalBasis: 'Consumer Protection (E-Commerce) Rules, 2020, Rule 5; Indian Contract Act, 1872.',
      },
      {
        heading: '6. Non-Refundable Items & Exclusions',
        content:
          'Items sold for rent do not carry purchase refunds beyond clause 1 defects and are instead governed by the Rental Terms and their inspection protocol. Earned Platform shipping fees, gift card loads, and prior disbursed payouts are likewise not refundable.',
        legalBasis: 'Consumer Protection (E-Commerce) Rules, 2020, Rule 5(3); Indian Contract Act, 1872.',
      },
      {
        heading: '7. Tax Adjustments on Returns',
        content:
          'Where a completed transaction attracts statutory TCS, the refunded amount is reconciled against your seller tax reports and the subsequent GST return cycle, and revised compliance documents are issued where required.',
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
    statutoryReference: 'Copyright Act, 1957 • Information Technology Rules, 2021 • CCPA Guidelines for Prevention of Misleading Advertisements & Greenwashing, 2024',
    quickTake: [
      'You retain ownership of your photos and text, granting KaPhor a limited licence to display them for listing and platform promotion.',
      'Respectful, harassment-free communication is enforced across all messaging and community surfaces.',
      'Environmental metrics (water saved, carbon offset, landfill diversion) are modeled estimates from published LCA textile benchmarks, not individual lab certification.',
      'Exaggerated or unsubstantiated eco claims constitute greenwashing and are penalized, including with listing removal.',
    ],
    clauses: [
      {
        heading: '1. Community Standards & Conduct',
        content:
          'All users must interact respectfully on the Platform. Harassment, hate speech, threats, spam, scamming, price-inflating collusion, and deliberate manipulation of listings or reviews are prohibited under applicable law and these standards.',
        legalBasis: 'Information Technology Rules, 2021, Rule 3(2)(b); Bharatiya Nyaya Sanhita, 2023.',
      },
      {
        heading: '2. Content Ownership & Licence',
        content:
          'You retain full copyright in the photos and text you upload. By publishing a listing or review, you grant KaPhor a non-exclusive, royalty-free, worldwide, sub-licensable licence to display, crop, optimize, reproduce, and feature that content to operate and promote the Platform.',
        legalBasis: 'Copyright Act, 1957; Information Technology Rules, 2021, Rule 3(1)(d).',
      },
      {
        heading: '3. Prohibited Content',
        content:
          'You may not upload content that is unlawful, defamatory, obscene, infringing, misleading about item condition, or that discloses another person private data. Content in violation is subject to removal under the takedown procedure in the Grievance Policy.',
        legalBasis: 'IT Act, 2000, Section 79(3)(b); Information Technology Rules, 2021, Rule 3(1)(b) and 3(1)(d).',
      },
      {
        heading: '4. Reporting & Moderation',
        content:
          'Any user may report content or conduct believed to violate these standards through the Report surface available on every listing and message. Reported content is reviewed under the timelines set out in the Grievance Policy, in line with due-process and safe-harbour requirements.',
        legalBasis: 'Information Technology Rules, 2021, Rule 3; Section 79 of the Information Technology Act, 2000.',
      },
      {
        heading: '5. Environmental Impact Methodology',
        content:
          'Impact Dashboard figures (liters of water preserved, kilograms of CO₂ offset, and landfill diversion weight) are modeled scientific estimates derived from published Life Cycle Assessment textile benchmarks, reflecting circular reuse versus virgin production. They are not laboratory-certified measurements and are presented as estimates.',
        legalBasis: 'CCPA Guidelines for Prevention and Regulation of Misleading Advertisements, 2024 (duty to substantiate environmental claims).',
      },
      {
        heading: '6. Prohibited Greenwashing',
        content:
          'Sellers and upcyclers must not make exaggerated or unsubstantiated eco-friendly claims (such as 100% carbon negative or chemically zero waste) without verifiable third-party certification, and any environmental claim must be specific, clear, and supported by the methodology disclosed under clause 5.',
        legalBasis: 'CCPA Guidelines for Prevention and Regulation of Greenwashing, 2024; Consumer Protection Act, 2019.',
      },
      {
        heading: '7. Consequences of Violations',
        content:
          'Content found to breach these standards may be removed or disabled without notice, and repeat or egregious violations may lead to warning notices, temporary suspension, permanent account deactivation, or referral to law enforcement authorities.',
        legalBasis: 'Information Technology Rules, 2021, Rule 3(2)(d); Consumer Protection Act, 2019.',
      },
    ],
  },
  {
    id: 'grievance-policy',
    title: 'Grievance Redressal & Compliance Contacts',
    shortTitle: 'Grievance Redressal',
    icon: 'mail-outline',
    badge: 'RULE 3(2) IT RULES',
    statutoryReference: 'IT (Intermediary Guidelines) Rules, 2021, Rule 3(2) • Consumer Protection Act, 2019 • DPDP Act, 2023, Section 18',
    quickTake: [
      'Designated Grievance Officer: Insiyah Bhatia, Grievance Officer & Data Protection Lead.',
      'Email: grievance@kaphor.com • Address: KaPhor Circular Fashion Hub, Mumbai, Maharashtra 400001.',
      'Complaints are acknowledged within 24 hours, redressed within 15 days, and unlawful content is actioned within 72 hours.',
      'Unresolved matters may be escalated to the National Consumer Helpline (1915), the Data Protection Board of India, or the competent civil courts.',
    ],
    clauses: [
      {
        heading: '1. Scope & Purpose',
        content:
          'This policy governs the lodging, processing, and resolution of user grievances relating to listings, orders, payments, rental and swap transactions, content, data protection, and Platform conduct. KaPhor is committed to fair, time-bound, and transparent resolution.',
        legalBasis: 'Information Technology Rules, 2021, Rule 3(2); Consumer Protection (E-Commerce) Rules, 2020; DPDP Act, 2023, Section 18.',
      },
      {
        heading: '2. Designated Grievance Officer',
        content:
          'In accordance with Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the Grievance Officer details are:\n\n• Name: Insiyah Bhatia\n• Designation: Grievance Officer & Data Protection Lead\n• Email: grievance@kaphor.com / legal@kaphor.com\n• Operational Address: KaPhor Circular Fashion Hub, Mumbai, Maharashtra 400001, India.',
        legalBasis: 'Information Technology (Intermediary Guidelines) Rules, 2021, Rule 3(2)(a).',
      },
      {
        heading: '3. How to File a Complaint',
        content:
          'You may file a grievance by email to the Grievance Officer or through the in-app Help and Support surface. Complaints should state your name, the issue, the transaction or content reference, and any supporting evidence. KaPhor does not charge any fee to file or pursue a complaint.',
        legalBasis: 'Information Technology Rules, 2021, Rule 3(2)(a); Consumer Protection (E-Commerce) Rules, 2020, Rule 12.',
      },
      {
        heading: '4. Mandatory Response Timelines',
        content:
          'The Grievance Officer shall acknowledge every complaint within 24 (twenty-four) hours and redress it within 15 (fifteen) days from receipt. Requests to remove unlawful content under Rule 3(1)(d) shall be actioned within 72 (seventy-two) hours of being brought to notice.',
        legalBasis: 'Information Technology Rules, 2021, Rule 3(2); Consumer Protection (E-Commerce) Rules, 2020, Rule 12.',
      },
      {
        heading: '5. Appeals & Review',
        content:
          'If you are not satisfied with the outcome, you may request a review by writing to the Grievance Officer with the reference number within 15 days of the resolution. The matter is re-examined independently and a final response is issued within 15 days of the appeal request.',
        legalBasis: 'Information Technology Rules, 2021, Rule 3(2)(d); Consumer Protection Act, 2019.',
      },
      {
        heading: '6. Unlawful Content Takedowns',
        content:
          'On receiving actual knowledge of unlawful content, including copyright-infringing imagery, KaPhor shall disable access within 36 hours of a compliant takedown notice and preserve the relevant records for investigation as required by law.',
        legalBasis: 'Information Technology Act, 2000, Section 79(3)(b) read with the IT Rules, 2021, Rule 3(1)(d).',
      },
      {
        heading: '7. Statutory Escalation Pathways',
        content:
          'If internal resolution does not satisfy you, you retain the right to escalate:\n\n• Consumer disputes: National Consumer Helpline (1915), the District Consumer Disputes Redressal Commission, or the State Consumer Disputes Redressal Commission under the Consumer Protection Act, 2019.\n• Data protection: The Data Protection Board of India under Section 18 of the DPDP Act, 2023.\n• Other disputes: The competent civil or other courts in Mumbai, Maharashtra, India.',
        legalBasis: 'Consumer Protection Act, 2019; Digital Personal Data Protection Act, 2023, Section 18.',
      },
      {
        heading: '8. Data Protection Complaints',
        content:
          'Complaints concerning personal data breaches, non-consensual processing, or failure to honour data principal rights are also handled under this policy. They are assessed in accordance with the Privacy Policy, and you may approach the Data Protection Board of India without exhausting internal remedies where permitted by law.',
        legalBasis: 'Digital Personal Data Protection Act, 2023, Sections 15 and 18.',
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
    title: 'Automated Secure Deposit',
    summary: '₹500 refundable security deposit held safely until both parties confirm receipt.',
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
