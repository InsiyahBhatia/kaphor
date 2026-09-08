import os
import sys
import json
import glob
from pathlib import Path
import numpy as np
import pandas as pd
from PIL import Image

# 1. Test YOLO Defect Detection on Mock Garment Images
def evaluate_yolo():
    print("=" * 60)
    print("1. RUNNING YOLO DEFECT DETECTOR (best.pt) ON MOCK GARMENTS")
    print("=" * 60)
    
    from ultralytics import YOLO
    model_path = os.path.abspath("kaphor-frontend/ml/best.pt")
    if not os.path.exists(model_path):
        print(f"Error: {model_path} not found")
        return []

    yolo = YOLO(model_path)
    
    # Gather mock garment images from backend uploads
    image_dirs = {
        "Rentals (Ethnic/Luxury)": "kaphor/backend/uploads/rentals",
        "Thrift (Western/Casual)": "kaphor/backend/uploads/thrift",
        "Swaps (Accessories/Jewelry)": "kaphor/backend/uploads/swaps"
    }

    results = []

    for group_name, dir_path in image_dirs.items():
        if not os.path.exists(dir_path):
            continue
        image_files = sorted(glob.glob(os.path.join(dir_path, "*.jpeg")) + glob.glob(os.path.join(dir_path, "*.jpg")))
        print(f"\n--- Group: {group_name} ({len(image_files)} images) ---")
        
        for img_path in image_files[:8]: # Sample 8 from each group for deep analysis
            filename = os.path.basename(img_path)
            try:
                pred = yolo(img_path, conf=0.25, verbose=False)[0]
                detected = []
                for box in pred.boxes:
                    cls_id = int(box.cls[0].item())
                    cls_name = pred.names[cls_id]
                    conf = float(box.conf[0].item())
                    detected.append(f"{cls_name} ({conf:.2f})")
                
                res_entry = {
                    "group": group_name,
                    "filename": filename,
                    "detections_count": len(detected),
                    "detections": detected,
                    "status": "DEFECT DETECTED" if detected else "CLEAN / NO DEFECT"
                }
                results.append(res_entry)
                det_str = ", ".join(detected) if detected else "None (Clean)"
                print(f"  [{filename:10s}] -> {det_str}")
            except Exception as e:
                print(f"  [{filename}] Error: {e}")

    return results

# 2. Test LightGBM Demand & Pricing Model on Mock Garments
def evaluate_lightgbm():
    print("\n" + "=" * 60)
    print("2. RUNNING LIGHTGBM PRICING & DEMAND ENGINE ON MOCK GARMENTS")
    print("=" * 60)
    
    import lightgbm as lgb
    
    model_dir = "kaphor-frontend/ml/data/models/demand_engine"
    meta_path = os.path.join(model_dir, "metadata.json")
    price_model_path = os.path.join(model_dir, "price_regressor_latest.txt")
    sales_model_path = os.path.join(model_dir, "classifier_latest.txt")
    days_model_path = os.path.join(model_dir, "days_regressor_latest.txt")
    
    if not (os.path.exists(meta_path) and os.path.exists(price_model_path)):
        print("LightGBM models or metadata missing.")
        return []

    with open(meta_path, "r") as f:
        meta = json.load(f)
    feature_names = meta.get("feature_names", [])

    price_booster = lgb.Booster(model_file=price_model_path)
    sales_booster = lgb.Booster(model_file=sales_model_path)
    days_booster = lgb.Booster(model_file=days_model_path)

    # Real mock garments from the platform database
    mock_test_items = [
        {
            "name": "Sabyasachi Velvet Bandhgala",
            "category": "bandhgala",
            "condition": "PRISTINE", # score 1.0
            "condition_score": 1.0,
            "brand_tier": 1.0, # Luxury
            "original_price": 85000,
            "actual_listed_price": 45000
        },
        {
            "name": "Banarasi Silk Saree",
            "category": "saree",
            "condition": "PRISTINE",
            "condition_score": 1.0,
            "brand_tier": 0.8,
            "original_price": 25000,
            "actual_listed_price": 12000
        },
        {
            "name": "Zara Textured Co-ord Set",
            "category": "dress",
            "condition": "PRISTINE",
            "condition_score": 0.9,
            "brand_tier": 0.4, # High street
            "original_price": 4990,
            "actual_listed_price": 3990
        },
        {
            "name": "Bewakoof Essential Grey Tee",
            "category": "tshirt",
            "condition": "MINOR_WEAR",
            "condition_score": 0.7,
            "brand_tier": 0.2, # Budget
            "original_price": 699,
            "actual_listed_price": 199
        },
        {
            "name": "Raw Mango Silk Kurta",
            "category": "kurta",
            "condition": "PRISTINE",
            "condition_score": 1.0,
            "brand_tier": 0.9,
            "original_price": 18000,
            "actual_listed_price": 9500
        },
        {
            "name": "Distressed Vintage Denim Jeans",
            "category": "jeans",
            "condition": "MINOR_WEAR",
            "condition_score": 0.6,
            "brand_tier": 0.3,
            "original_price": 3500,
            "actual_listed_price": 1800
        },
        {
            "name": "Oxidised Silver Jhumka Earrings",
            "category": "jewellery",
            "condition": "PRISTINE",
            "condition_score": 1.0,
            "brand_tier": 0.3,
            "original_price": 1500,
            "actual_listed_price": 1290
        }
    ]

    print(f"{'Item Name':32s} | {'Actual MRP':10s} | {'Listed Px':10s} | {'LGBM Rec Px':12s} | {'Sales Prob':10s} | {'Days to Sell'}")
    print("-" * 95)

    lgb_results = []

    for item in mock_test_items:
        # Build one-hot feature vector matching metadata.json
        row = {f: 0.0 for f in feature_names}
        row["brand_tier_score"] = item["brand_tier"]
        row["condition_score"] = item["condition_score"]
        row["original_price"] = float(item["original_price"])
        row["listed_price"] = float(item["actual_listed_price"])
        row["seasonal_demand_boost"] = 0.5
        row["price_discount_ratio"] = 1.0 - (item["actual_listed_price"] / max(item["original_price"], 1))
        row["price_factor"] = item["actual_listed_price"] / max(item["original_price"], 1)
        
        cat_key = f"cat_{item['category']}"
        if cat_key in row:
            row[cat_key] = 1.0
        row["season_Summer"] = 1.0
        row["clim_temperate"] = 1.0

        df = pd.DataFrame([row])[feature_names]
        
        # price_booster and days_booster use all 59 features
        pred_price_log = float(price_booster.predict(df)[0])
        pred_days_log = float(days_booster.predict(df)[0])
        
        # classifier_latest was trained on only 5 features:
        # ['listed_price', 'original_price', 'condition_score', 'brand_tier_score', 'discount_ratio']
        df_clf = pd.DataFrame([{
            'listed_price': float(item['actual_listed_price']),
            'original_price': float(item['original_price']),
            'condition_score': float(item['condition_score']),
            'brand_tier_score': float(item['brand_tier']),
            'discount_ratio': 1.0 - (item['actual_listed_price'] / max(item['original_price'], 1))
        }])
        pred_prob = float(sales_booster.predict(df_clf)[0])

        # Invert log1p target transforms used during training (np.log1p)
        pred_price = float(np.expm1(pred_price_log))
        pred_days = float(np.expm1(pred_days_log))

        print(f"{item['name']:32s} | Rs.{item['original_price']:8,d} | Rs.{item['actual_listed_price']:8,d} | Rs.{pred_price:10,.0f} | {pred_prob * 100:8.1f}% | {pred_days:6.0f} days")
        lgb_results.append({
            "item": item["name"],
            "original_price": item["original_price"],
            "actual_listed": item["actual_listed_price"],
            "predicted_price": pred_price,
            "sale_probability": pred_prob,
            "days_to_sell": pred_days
        })

    return lgb_results

if __name__ == "__main__":
    yolo_res = evaluate_yolo()
    lgb_res = evaluate_lightgbm()

    summary = {
        "yolo_detections": yolo_res,
        "lightgbm_predictions": lgb_res
    }
    with open("kaphor/backend/scratch/real_world_eval_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    print("\n✓ Evaluation complete. Summary written to kaphor/backend/scratch/real_world_eval_summary.json")
