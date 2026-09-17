import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';

export async function getGarmentLifecycle(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const garment = await db.garment.findUnique({
            where: { id }
        });

        if (!garment) {
            res.status(404).json({ error: 'NOT_FOUND' });
            return;
        }

        const mockFiber = garment.recyclableFiber || 75;
        let recommendedAction = 'RE_SELL';

        if (mockFiber > 80) recommendedAction = 'RECYCLE_ONLY';
        else if (mockFiber > 50) recommendedAction = 'UPCYCLE';

        res.json({
            data: {
                lifecycleState: garment.lifecycleState,
                recyclableFiber: mockFiber,
                condition: garment.condition,
                recommendedAction
            }
        });
    } catch (error) {
        logger.error('Failed fetching lifecycle', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function scheduleCollection(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { garmentId, address, preferredSlot, partnerId } = req.body;

        if (!garmentId || !address || !preferredSlot || !partnerId) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing fields' });
            return;
        }

        const garment = await db.garment.findUnique({ where: { id: garmentId } });
        if (!garment || garment.sellerId !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN' });
            return;
        }

        // Create the collection request
        const request = await db.circularRequest.create({
            data: {
                userId: req.user.id,
                garmentId,
                address,
                preferredSlot,
                partnerId,
                status: 'SCHEDULED'
            }
        });

        // Update garment lifecycle conceptually
        await db.garment.update({
            where: { id: garmentId },
            data: {
                lifecycleState: 'REUSE_UPCYCLE_RECYCLE',
                isActive: false
            }
        });

        // Simulate sending an email:
        logger.info(`Sending circular collection email to ${req.user.email} for slot ${preferredSlot}`);

        res.status(201).json({ data: request });
    } catch (error) {
        logger.error('Failed scheduling collection', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function getPartners(req: Request, res: Response): Promise<void> {
    try {
        const partners = [
            { id: 'p1', name: 'Renewcell', type: 'Recycler' },
            { id: 'p2', name: 'KaPhor Lab', type: 'Upcycler' },
            { id: 'p3', name: 'EcoCer', type: 'Processor' }
        ];

        res.json({ data: partners });
    } catch (error) {
        logger.error('Failed fetching partners', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export const CERTIFIED_RECYCLING_CENTERS = [
  {
    id: 'rc-mumbai-west',
    name: 'EcoReclaim Western Circular Hub',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincodePrefix: ['400'],
    address: 'Plot 42, Bandra-Kurla Complex / Mahim Textile Cluster, Mumbai, Maharashtra 400051',
    phone: '+91 22 2654 8800',
    operatingHours: 'Mon-Sat: 09:00 - 19:00',
    acceptedFibers: ['100% Cotton', 'Denim', 'Wool & Cashmere', 'Polyester Blends'],
    certifications: ['OEKO-TEX Circular Standard', 'ISO 14001:2015', 'Global Recycled Standard (GRS)'],
    doorstepPickup: true,
    dropOffAvailable: true,
    rating: 4.9,
    reviewsCount: 184,
    zeroLandfillScore: 98,
    description: 'Premier certified mechanical & chemical fiber shredding and regeneration hub for MMR.',
  },
  {
    id: 'rc-mumbai-navi',
    name: 'Apex Circular Fibers & Reclamation',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    pincodePrefix: ['400', '410'],
    address: 'Sector 8, TTC Industrial Area, Turbhe, Navi Mumbai, Maharashtra 400705',
    phone: '+91 22 2768 1120',
    operatingHours: 'Mon-Fri: 09:30 - 18:30',
    acceptedFibers: ['Cotton Blends', 'Denim', 'Linen', 'Synthetics'],
    certifications: ['GRS Certified', 'Zero Discharge (ZDHC)'],
    doorstepPickup: true,
    dropOffAvailable: true,
    rating: 4.8,
    reviewsCount: 92,
    zeroLandfillScore: 96,
    description: 'Specializes in high-tensile denim and woven fabric closed-loop recycling.',
  },
  {
    id: 'rc-delhi-ncr',
    name: 'Delhi NCR Circular Fiber Park',
    city: 'Delhi',
    state: 'Delhi',
    pincodePrefix: ['110', '122', '201'],
    address: 'B-14, Okhla Industrial Area Phase III, New Delhi 110020',
    phone: '+91 11 4160 3211',
    operatingHours: 'Mon-Sat: 10:00 - 18:30',
    acceptedFibers: ['Denim', 'Cotton', 'Knitted Garments', 'Silk & Synthetics'],
    certifications: ['Global Recycled Standard (GRS)', 'Higg Index Verified', 'ISO 14001'],
    doorstepPickup: true,
    dropOffAvailable: true,
    rating: 4.9,
    reviewsCount: 240,
    zeroLandfillScore: 99,
    description: 'Largest northern closed-loop recovery park with automated optical fiber sorting.',
  },
  {
    id: 'rc-bengaluru',
    name: 'GreenFiber Tech Recyclers',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincodePrefix: ['560', '561'],
    address: '4th Cross, Peenya Industrial Estate 2nd Stage, Bengaluru, Karnataka 560058',
    phone: '+91 80 2839 7720',
    operatingHours: 'Mon-Sat: 09:00 - 18:00',
    acceptedFibers: ['100% Cotton', 'Organic Linen', 'Woolen Knitwear', 'Poly-Cotton Blends'],
    certifications: ['OEKO-TEX STeP', 'ZDHC Level 3', 'ISO 9001/14001'],
    doorstepPickup: true,
    dropOffAvailable: true,
    rating: 4.9,
    reviewsCount: 312,
    zeroLandfillScore: 99,
    description: 'State-of-the-art biological and enzymatic cotton-cellulose recycling partner.',
  },
  {
    id: 'rc-hyderabad',
    name: 'Telangana Closed-Loop Textile Facility',
    city: 'Hyderabad',
    state: 'Telangana',
    pincodePrefix: ['500', '501'],
    address: 'Road 5, Sanathnagar Industrial Estate, Hyderabad, Telangana 500018',
    phone: '+91 40 2370 1900',
    operatingHours: 'Mon-Sat: 09:30 - 18:30',
    acceptedFibers: ['Cotton', 'Viscose', 'Rayon', 'Heavy Denim'],
    certifications: ['OEKO-TEX STeP', 'ISO 14001', 'GRS Certified'],
    doorstepPickup: true,
    dropOffAvailable: true,
    rating: 4.8,
    reviewsCount: 118,
    zeroLandfillScore: 97,
    description: 'Certified regional re-spinning facility transforming worn textiles into new yarn.',
  },
  {
    id: 'rc-pune',
    name: 'Deccan Sustainable Textiles Hub',
    city: 'Pune',
    state: 'Maharashtra',
    pincodePrefix: ['411', '412'],
    address: 'Survey 28, Hadapsar Industrial Estate, Pune, Maharashtra 411013',
    phone: '+91 20 2687 4500',
    operatingHours: 'Mon-Sat: 09:00 - 18:00',
    acceptedFibers: ['Mixed Fibers', 'Pure Cotton', 'Denim', 'Fleece'],
    certifications: ['GRS Certified', 'ISO 9001:2015', 'Maharashtra Green Hub'],
    doorstepPickup: true,
    dropOffAvailable: true,
    rating: 4.7,
    reviewsCount: 89,
    zeroLandfillScore: 95,
    description: 'Zero-water recycling unit creating insulation and regenerated thread.',
  },
  {
    id: 'rc-chennai',
    name: 'Coromandel Textile Recovery Center',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincodePrefix: ['600', '601'],
    address: 'Inner Ring Road, Guindy Industrial Estate, Chennai, Tamil Nadu 600032',
    phone: '+91 44 2250 1800',
    operatingHours: 'Mon-Sat: 09:30 - 18:30',
    acceptedFibers: ['Knits', 'Wovens', 'Blended Fabrics', 'Cotton Sarees'],
    certifications: ['ISO 14001', 'Higg FEM Verified', 'OEKO-TEX Circular'],
    doorstepPickup: true,
    dropOffAvailable: true,
    rating: 4.8,
    reviewsCount: 142,
    zeroLandfillScore: 96,
    description: 'Pioneering Tamil Nadu industrial circularity hub for garment waste diversion.',
  },
  {
    id: 'rc-ahmedabad',
    name: 'Sabarmati Circular Fiber Lab',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincodePrefix: ['380', '382'],
    address: 'Phase 2, Naroda GIDC, Ahmedabad, Gujarat 382330',
    phone: '+91 79 2282 3400',
    operatingHours: 'Mon-Sat: 09:00 - 19:00',
    acceptedFibers: ['Cotton', 'Handloom Blends', 'Denim', 'Khadi'],
    certifications: ['Cotton Made in Africa (CmiA)', 'GRS Certified', 'ISO 14001'],
    doorstepPickup: true,
    dropOffAvailable: true,
    rating: 4.8,
    reviewsCount: 167,
    zeroLandfillScore: 97,
    description: 'Specialized in handloom, raw cotton and denim waste fiber reclamation.',
  },
  {
    id: 'rc-national-mailin',
    name: 'Kaphor National Zero-Landfill Box (Mail-In)',
    city: 'Pan-India',
    state: 'All States',
    pincodePrefix: [],
    address: 'Kaphor Central Circular Hub, Gateway Logistics Park, Bhiwandi, Maharashtra 421302',
    phone: '1800-KAPHOR-ECO',
    operatingHours: '24/7 Digital Booking • Daily Doorstep Courier Pickup',
    acceptedFibers: ['All Non-wearable Garments', 'Fabric Scraps', 'Shoes & Belts (Disassembled)'],
    certifications: ['Zero Waste to Landfill Gold', 'ISO 14001', 'UN Fashion Charter Signatory'],
    doorstepPickup: true,
    dropOffAvailable: false,
    rating: 5.0,
    reviewsCount: 1420,
    zeroLandfillScore: 100,
    description: 'Free prepaid doorstep courier collection across India for any unwearable clothing items.',
  },
];

export async function getRecyclingCenters(req: Request, res: Response): Promise<void> {
  try {
    let city = (req.query.city as string)?.trim();
    let pincode = (req.query.pincode as string)?.trim();
    let userLocationSource = 'QUERY';

    // If no explicit query parameters and user is authenticated, query user's saved addresses
    if ((!city || !pincode) && (req as any).user?.id) {
      const userId = (req as any).user.id;
      const defaultAddress = await db.address.findFirst({
        where: { userId, isDefault: true },
        select: { city: true, state: true, pincode: true },
      }) || await db.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { city: true, state: true, pincode: true },
      });

      if (defaultAddress) {
        if (!city && defaultAddress.city) city = defaultAddress.city;
        if (!pincode && defaultAddress.pincode) pincode = defaultAddress.pincode;
        userLocationSource = 'SAVED_ADDRESS';
      } else {
        const userProfile = await db.user.findUnique({
          where: { id: userId },
          select: { location: true },
        });
        if (!city && userProfile?.location) {
          city = userProfile.location;
          userLocationSource = 'USER_PROFILE';
        }
      }
    }

    const cityNorm = (city || '').toLowerCase();
    const pinPrefix = (pincode || '').slice(0, 3);

    // Score and rank centers according to location
    const scoredCenters = CERTIFIED_RECYCLING_CENTERS.map((center) => {
      let score = 0;
      let estimatedDistance: string = 'Regional Hub';

      // Special priority for National Mail-In
      if (center.id === 'rc-national-mailin') {
        score = 50;
        estimatedDistance = 'Doorstep Pickup (All India)';
      }

      // Check pincode prefix match
      if (pinPrefix && center.pincodePrefix.includes(pinPrefix)) {
        score = 100;
        estimatedDistance = '3.8 km away';
      } else if (
        cityNorm &&
        (center.city.toLowerCase().includes(cityNorm) ||
          cityNorm.includes(center.city.toLowerCase()))
      ) {
        score = 90;
        estimatedDistance = 'In your city (~5-8 km)';
      } else if (
        cityNorm &&
        (cityNorm.includes('mumbai') || cityNorm.includes('thane') || cityNorm.includes('pune')) &&
        center.state === 'Maharashtra'
      ) {
        score = 70;
        estimatedDistance = 'Same State (~25 km)';
      } else if (
        cityNorm &&
        (cityNorm.includes('delhi') || cityNorm.includes('noida') || cityNorm.includes('gurgaon') || cityNorm.includes('faridabad')) &&
        (center.city === 'Delhi' || center.state === 'Delhi')
      ) {
        score = 95;
        estimatedDistance = 'NCR Regional (~6 km)';
      }

      return {
        ...center,
        score,
        distance: estimatedDistance,
        isClosestMatch: score >= 90,
      };
    });

    // Sort closest matches first
    scoredCenters.sort((a, b) => b.score - a.score);

    res.json({
      data: {
        userLocation: {
          city: city || 'Detected Location',
          pincode: pincode || null,
          source: userLocationSource,
        },
        centers: scoredCenters,
      },
    });
  } catch (error) {
    logger.error('Failed fetching recycling centers', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Could not load recycling centers' });
  }
}

