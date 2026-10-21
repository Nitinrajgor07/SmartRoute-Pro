import sys
import os
import datetime
import json
from app import create_app
from app.extensions import db
from app.models import Location, Road, Delivery, User, ClusterRun, ClusterAssignment

def seed_database(app=None):
    """
    Idempotent development database seeder for SmartRoute Pro.
    - Seeds realistic locations, roads, and deliveries.
    - All sample records use clearly identifiable identifiers (e.g., TRK-DEMO-...).
    - Idempotent: safe to run multiple times without creating duplicates.
    - Preserves all existing user records and real data.
    """
    if app is None:
        env_name = os.getenv('FLASK_ENV', 'development')
        app = create_app(env_name)
    else:
        env_name = app.config.get('ENV', 'testing')
    with app.app_context():
        print(f"[*] Starting SmartRoute Pro database seeder in [{env_name}] mode...")

        # 1. Seed Locations (Hubs, Depots, and Delivery Waypoints)
        sample_locations = [
            {
                "name": "Majestic Depot",
                "address": "Kempegowda Bus Station Rd, Gandhi Nagar",
                "latitude": 12.9767,
                "longitude": 77.5713
            },
            {
                "name": "Koramangala",
                "address": "80 Feet Rd, Koramangala 4th Block",
                "latitude": 12.9352,
                "longitude": 77.6245
            },
            {
                "name": "Jayanagar",
                "address": "11th Main Rd, Jayanagar 4th Block",
                "latitude": 12.925,
                "longitude": 77.5938
            },
            {
                "name": "Malleshwaram",
                "address": "Sampige Rd, Malleshwaram",
                "latitude": 13.0035,
                "longitude": 77.571
            },
            {
                "name": "Indiranagar",
                "address": "100 Feet Rd, Indiranagar",
                "latitude": 12.9784,
                "longitude": 77.6408
            },
            {
                "name": "Whitefield",
                "address": "ITPL Main Rd, Whitefield",
                "latitude": 12.9698,
                "longitude": 77.75
            },
            {
                "name": "Yelahanka",
                "address": "Doddaballapur Rd, Yelahanka New Town",
                "latitude": 13.1007,
                "longitude": 77.5963
            },
            # Expanded realistic urban delivery hubs (simulated logistics facilities)
            {
                "name": "MG Road",
                "address": "Mahatma Gandhi Rd, Ashok Nagar",
                "latitude": 12.9756,
                "longitude": 77.605
            },
            {
                "name": "Shivajinagar",
                "address": "Commercial St, Shivajinagar",
                "latitude": 12.9857,
                "longitude": 77.6057
            },
            {
                "name": "Richmond Town",
                "address": "Richmond Rd, Richmond Town",
                "latitude": 12.9634,
                "longitude": 77.6008
            },
            {
                "name": "Basavanagudi",
                "address": "Bull Temple Rd, Basavanagudi",
                "latitude": 12.9421,
                "longitude": 77.574
            },
            {
                "name": "BTM Layout",
                "address": "16th Main Rd, BTM 2nd Stage",
                "latitude": 12.9166,
                "longitude": 77.6101
            },
            {
                "name": "HSR Layout",
                "address": "27th Main Rd, HSR Sector 1",
                "latitude": 12.9116,
                "longitude": 77.6474
            },
            {
                "name": "Bommanahalli",
                "address": "Hosur Rd, Bommanahalli",
                "latitude": 12.903,
                "longitude": 77.624
            },
            {
                "name": "Vijayanagar",
                "address": "Magadi Main Rd, Vijayanagar",
                "latitude": 12.9719,
                "longitude": 77.53
            },
            {
                "name": "Rajajinagar",
                "address": "Dr Rajkumar Rd, Rajajinagar",
                "latitude": 12.991,
                "longitude": 77.552
            },
            {
                "name": "Hebbal",
                "address": "Bellary Rd, Hebbal",
                "latitude": 13.0358,
                "longitude": 77.597
            },
            {
                "name": "Yeshwanthpur",
                "address": "Tumkur Rd, Yeshwanthpur",
                "latitude": 13.028,
                "longitude": 77.54
            },
            {
                "name": "Vidhana Soudha",
                "address": "Ambedkar Veedhi, Sampangi Rama Nagar",
                "latitude": 12.9794,
                "longitude": 77.591
            },
            {
                "name": "Banashankari",
                "address": "Kanakapura Rd, Banashankari",
                "latitude": 12.9255,
                "longitude": 77.5468
            },
            {
                "name": "JP Nagar",
                "address": "24th Main Rd, JP Nagar 6th Phase",
                "latitude": 12.9063,
                "longitude": 77.5857
            },
            {
                "name": "Bannerghatta Road",
                "address": "Bannerghatta Main Rd, Arekere",
                "latitude": 12.889,
                "longitude": 77.597
            },
            {
                "name": "Ulsoor",
                "address": "Kensington Rd, Ulsoor",
                "latitude": 12.9817,
                "longitude": 77.62
            },
            {
                "name": "RT Nagar",
                "address": "CBI Main Rd, RT Nagar",
                "latitude": 13.0213,
                "longitude": 77.594
            }
        ]

        # Rename map for seamless dev database upgrade
        rename_map = {
            "Central Depot (Origin)": "Majestic Depot",
            "Zone 1: Tech Hub": "Koramangala",
            "Zone 2: Medical Center": "Jayanagar",
            "Zone 3: Metro Mall": "Malleshwaram",
            "Zone 4: Research Park": "Indiranagar",
            "Zone 5: Harbor Pier": "Whitefield",
            "Zone 5: Harbor Pier (Dest)": "Whitefield",
            "Zone 6: North Outpost (Isolated Station)": "Yelahanka",
            "Downtown Logistics Hub": "MG Road",
            "Financial District Express Center": "Shivajinagar",
            "SoMa Freight Distribution Center": "Richmond Town",
            "Mission District Delivery Hub": "Basavanagudi",
            "Potrero Hill Fulfillment Terminal": "BTM Layout",
            "Dogpatch Cargo Post": "HSR Layout",
            "Bayview Distribution Annex": "Bommanahalli",
            "Sunset Logistics Station": "Vijayanagar",
            "Richmond Delivery Depot": "Rajajinagar",
            "Marina Gateway Hub": "Hebbal",
            "Presidio Logistics Post": "Yeshwanthpur",
            "Civic Center Dispatch Facility": "Vidhana Soudha",
            "Twin Peaks Relay Station": "Banashankari",
            "Bernal Heights Delivery Center": "JP Nagar",
            "Excelsior Parcel Hub": "Bannerghatta Road",
            "Embarcadero Transit Depot": "Ulsoor",
            "Fisherman's Wharf Delivery Bay": "RT Nagar",
                    "Central Depot": "Majestic Depot",
            "Tech Park": "Koramangala",
            "Medical Center": "Jayanagar",
            "Metro Mall": "Malleshwaram",
            "Research Park": "Indiranagar",
            "Harbor Pier": "Whitefield",
            "North Outpost": "Yelahanka",
            "Downtown": "MG Road",
            "Financial Dist": "Shivajinagar",
            "SoMa": "Richmond Town",
            "Mission": "Basavanagudi",
            "Potrero Hill": "BTM Layout",
            "Dogpatch": "HSR Layout",
            "Bayview": "Bommanahalli",
            "Sunset": "Vijayanagar",
            "Richmond": "Rajajinagar",
            "Marina": "Hebbal",
            "Presidio": "Yeshwanthpur",
            "Civic Center": "Vidhana Soudha",
            "Twin Peaks": "Banashankari",
            "Bernal Heights": "JP Nagar",
            "Excelsior": "Bannerghatta Road",
            "Embarcadero": "Ulsoor",
            "Fishermans Wharf": "RT Nagar",
}
        for old_n, new_n in rename_map.items():
            old_loc = Location.query.filter_by(name=old_n).first()
            if old_loc:
                existing_target = Location.query.filter_by(name=new_n).first()
                if not existing_target:
                    old_loc.name = new_n
        db.session.commit()

        locations_by_name = {}
        locations_added = 0
        for loc_data in sample_locations:
            existing = Location.query.filter_by(name=loc_data["name"]).first()
            if not existing:
                loc = Location(**loc_data)
                db.session.add(loc)
                db.session.flush()
                locations_by_name[loc.name] = loc
                locations_added += 1
            else:
                existing.address = loc_data["address"]
                existing.latitude = loc_data["latitude"]
                existing.longitude = loc_data["longitude"]
                locations_by_name[existing.name] = existing

        db.session.commit()
        print(f"[*] Locations: {locations_added} new locations added, {len(sample_locations) - locations_added} already existed.")

        # 2. Seed Roads (Directed Graph Segments)
        def get_hub(name):
            return locations_by_name[name]

        depot = get_hub("Majestic Depot")
        z1 = get_hub("Koramangala")
        z2 = get_hub("Jayanagar")
        z3 = get_hub("Malleshwaram")
        z4 = get_hub("Indiranagar")
        z5 = get_hub("Whitefield")
        z6 = get_hub("Yelahanka")

        downtown = get_hub("MG Road")
        fidi = get_hub("Shivajinagar")
        soma = get_hub("Richmond Town")
        mission = get_hub("Basavanagudi")
        potrero = get_hub("BTM Layout")
        dogpatch = get_hub("HSR Layout")
        bayview = get_hub("Bommanahalli")
        sunset = get_hub("Vijayanagar")
        richmond = get_hub("Rajajinagar")
        marina = get_hub("Hebbal")
        presidio = get_hub("Yeshwanthpur")
        civic = get_hub("Vidhana Soudha")
        twin_peaks = get_hub("Banashankari")
        bernal = get_hub("JP Nagar")
        excelsior = get_hub("Bannerghatta Road")
        embarcadero = get_hub("Ulsoor")
        fishermans = get_hub("RT Nagar")

        # Format: (source_id, dest_id, distance_km, duration_min, is_active)
        sample_roads = [
            # Original preserved road corridors
            (depot.id, z1.id, 6.2, 14.0, True),
            (depot.id, z2.id, 8.5, 20.0, True),
            (z1.id, z3.id, 5.4, 12.0, True),
            (z1.id, z4.id, 7.9, 18.0, True),
            (z2.id, z4.id, 6.8, 16.0, True),
            (z2.id, z3.id, 4.8, 11.0, True),
            (z3.id, z5.id, 4.3, 10.0, True),
            (z4.id, z5.id, 5.7, 13.0, True),
            (z5.id, depot.id, 16.5, 30.0, True),  # Return corridor
            (depot.id, z6.id, 14.2, 28.0, False), # Inactive road segment to isolated node (tests inactive exclusion)

            # Core City Interconnections (Bidirectional corridors)
            (depot.id, civic.id, 1.2, 3.5, True),
            (civic.id, depot.id, 1.2, 3.5, True),
            (depot.id, soma.id, 1.8, 4.5, True),
            (soma.id, depot.id, 1.8, 4.5, True),
            (depot.id, mission.id, 2.4, 6.0, True),
            (mission.id, depot.id, 2.4, 6.0, True),

            (civic.id, downtown.id, 1.5, 4.0, True),
            (downtown.id, civic.id, 1.5, 4.0, True),
            (civic.id, z1.id, 1.4, 3.8, True),
            (z1.id, civic.id, 1.4, 3.8, True),

            (downtown.id, fidi.id, 1.1, 3.0, True),
            (fidi.id, downtown.id, 1.1, 3.0, True),
            (downtown.id, soma.id, 1.3, 3.5, True),
            (soma.id, downtown.id, 1.3, 3.5, True),
            (downtown.id, embarcadero.id, 1.6, 4.5, True),
            (embarcadero.id, downtown.id, 1.6, 4.5, True),

            (fidi.id, z4.id, 0.8, 2.0, True),
            (z4.id, fidi.id, 0.8, 2.0, True),
            (fidi.id, embarcadero.id, 0.9, 2.5, True),
            (embarcadero.id, fidi.id, 0.9, 2.5, True),
            (fidi.id, fishermans.id, 2.2, 6.0, True),
            (fishermans.id, fidi.id, 2.2, 6.0, True),

            (embarcadero.id, z5.id, 2.6, 7.0, True),
            (z5.id, embarcadero.id, 2.6, 7.0, True),
            (embarcadero.id, fishermans.id, 2.4, 6.5, True),
            (fishermans.id, embarcadero.id, 2.4, 6.5, True),

            (fishermans.id, marina.id, 2.5, 7.0, True),
            (marina.id, fishermans.id, 2.5, 7.0, True),
            (marina.id, presidio.id, 2.8, 7.5, True),
            (presidio.id, marina.id, 2.8, 7.5, True),
            (marina.id, z1.id, 3.2, 8.5, True),
            (z1.id, marina.id, 3.2, 8.5, True),

            (presidio.id, richmond.id, 2.6, 7.0, True),
            (richmond.id, presidio.id, 2.6, 7.0, True),
            (richmond.id, sunset.id, 3.4, 9.0, True),
            (sunset.id, richmond.id, 3.4, 9.0, True),
            (richmond.id, z3.id, 2.5, 6.5, True),
            (z3.id, richmond.id, 2.5, 6.5, True),

            (sunset.id, z3.id, 2.3, 6.0, True),
            (z3.id, sunset.id, 2.3, 6.0, True),
            (sunset.id, twin_peaks.id, 3.6, 9.5, True),
            (twin_peaks.id, sunset.id, 3.6, 9.5, True),

            (twin_peaks.id, z3.id, 2.1, 5.5, True),
            (z3.id, twin_peaks.id, 2.1, 5.5, True),
            (twin_peaks.id, mission.id, 2.9, 7.5, True),
            (mission.id, twin_peaks.id, 2.9, 7.5, True),
            (twin_peaks.id, z2.id, 2.7, 7.0, True),
            (z2.id, twin_peaks.id, 2.7, 7.0, True),

            (mission.id, potrero.id, 1.9, 5.0, True),
            (potrero.id, mission.id, 1.9, 5.0, True),
            (mission.id, bernal.id, 2.1, 5.5, True),
            (bernal.id, mission.id, 2.1, 5.5, True),
            (mission.id, z2.id, 2.0, 5.0, True),
            (z2.id, mission.id, 2.0, 5.0, True),

            (soma.id, potrero.id, 2.3, 6.0, True),
            (potrero.id, soma.id, 2.3, 6.0, True),
            (soma.id, z5.id, 2.2, 5.5, True),
            (z5.id, soma.id, 2.2, 5.5, True),

            (potrero.id, dogpatch.id, 1.2, 3.0, True),
            (dogpatch.id, potrero.id, 1.2, 3.0, True),
            (dogpatch.id, z5.id, 1.9, 5.0, True),
            (z5.id, dogpatch.id, 1.9, 5.0, True),
            (dogpatch.id, bayview.id, 3.2, 8.0, True),
            (bayview.id, dogpatch.id, 3.2, 8.0, True),

            (bayview.id, bernal.id, 2.8, 7.0, True),
            (bernal.id, bayview.id, 2.8, 7.0, True),
            (bayview.id, excelsior.id, 3.9, 10.0, True),
            (excelsior.id, bayview.id, 3.9, 10.0, True),

            (bernal.id, z2.id, 1.4, 3.5, True),
            (z2.id, bernal.id, 1.4, 3.5, True),
            (bernal.id, excelsior.id, 2.4, 6.0, True),
            (excelsior.id, bernal.id, 2.4, 6.0, True),
            (excelsior.id, z2.id, 2.6, 6.5, True),
            (z2.id, excelsior.id, 2.6, 6.5, True)
        ]

        roads_added = 0
        for road_entry in sample_roads:
            src_id, dst_id, dist, dur = road_entry[0], road_entry[1], road_entry[2], road_entry[3]
            is_act = road_entry[4] if len(road_entry) > 4 else True
            existing = Road.query.filter_by(source_location_id=src_id, destination_location_id=dst_id).first()
            if not existing:
                road = Road(
                    source_location_id=src_id,
                    destination_location_id=dst_id,
                    distance_km=dist,
                    estimated_duration_minutes=dur,
                    is_active=is_act
                )
                db.session.add(road)
                roads_added += 1

        db.session.commit()
        print(f"[*] Roads: {roads_added} new road connections added.")

        # 2b. Extended Bengaluru hub network (route planner coverage).
        # These hubs are added for route planning only; delivery seeding below keeps
        # using the 24 core hubs so the seeded statistics stay unchanged.
        extra_locations = [
            {"name": "Hennur", "address": "Hennur Main Rd, Hennur", "latitude": 13.0358, "longitude": 77.639},
            {"name": "Kalyan Nagar", "address": "HRBR Layout, Kalyan Nagar", "latitude": 13.028, "longitude": 77.64},
            {"name": "Banaswadi", "address": "Banaswadi Main Rd, Banaswadi", "latitude": 13.0141, "longitude": 77.6518},
            {"name": "KR Puram", "address": "Old Madras Rd, KR Puram", "latitude": 13.0076, "longitude": 77.695},
            {"name": "Marathahalli", "address": "Outer Ring Rd, Marathahalli", "latitude": 12.9569, "longitude": 77.7011},
            {"name": "Bellandur", "address": "Outer Ring Rd, Bellandur", "latitude": 12.926, "longitude": 77.6762},
            {"name": "Sarjapur Road", "address": "Sarjapur Main Rd, Kaikondrahalli", "latitude": 12.91, "longitude": 77.686},
            {"name": "Electronic City", "address": "Hosur Rd, Electronic City Phase 1", "latitude": 12.8452, "longitude": 77.6602},
            {"name": "Silk Board", "address": "Hosur Rd, Silk Board Junction", "latitude": 12.9177, "longitude": 77.6238},
            {"name": "Domlur", "address": "Old Airport Rd, Domlur", "latitude": 12.961, "longitude": 77.6387},
            {"name": "Frazer Town", "address": "Mosque Rd, Frazer Town", "latitude": 12.9988, "longitude": 77.615},
            {"name": "Cox Town", "address": "Wheeler Rd, Cox Town", "latitude": 12.997, "longitude": 77.625},
            {"name": "Sadashivanagar", "address": "Bellary Rd, Sadashivanagar", "latitude": 13.0068, "longitude": 77.5813},
            {"name": "Sanjay Nagar", "address": "Sanjay Nagar Main Rd", "latitude": 13.0335, "longitude": 77.577},
            {"name": "Mathikere", "address": "New BEL Rd, Mathikere", "latitude": 13.033, "longitude": 77.563},
            {"name": "Peenya", "address": "Peenya Industrial Area, Phase 2", "latitude": 13.0285, "longitude": 77.5197},
            {"name": "Jalahalli", "address": "MES Rd, Jalahalli", "latitude": 13.045, "longitude": 77.545},
            {"name": "Vidyaranyapura", "address": "Vidyaranyapura Main Rd", "latitude": 13.079, "longitude": 77.558},
            {"name": "Jakkur", "address": "Jakkur Main Rd, Jakkur", "latitude": 13.078, "longitude": 77.606},
            {"name": "Thanisandra", "address": "Thanisandra Main Rd", "latitude": 13.056, "longitude": 77.633},
            {"name": "Nagawara", "address": "Outer Ring Rd, Nagawara", "latitude": 13.041, "longitude": 77.62},
            {"name": "Basaveshwaranagar", "address": "West of Chord Rd, Basaveshwaranagar", "latitude": 12.993, "longitude": 77.539},
            {"name": "Nagarbhavi", "address": "Nagarbhavi Main Rd", "latitude": 12.96, "longitude": 77.51},
            {"name": "Kengeri", "address": "Mysore Rd, Kengeri", "latitude": 12.908, "longitude": 77.482},
            {"name": "RR Nagar", "address": "Ideal Homes Township, Rajarajeshwari Nagar", "latitude": 12.927, "longitude": 77.515},
            {"name": "Uttarahalli", "address": "Uttarahalli Main Rd", "latitude": 12.905, "longitude": 77.544},
            {"name": "Kumaraswamy Layout", "address": "Kumaraswamy Layout Main Rd", "latitude": 12.906, "longitude": 77.563},
            {"name": "Wilson Garden", "address": "Hosur Rd, Wilson Garden", "latitude": 12.949, "longitude": 77.597},
            {"name": "Lalbagh", "address": "Lalbagh Main Gate, Mavalli", "latitude": 12.9507, "longitude": 77.5848},
            {"name": "Chamarajpet", "address": "Bull Temple Rd, Chamarajpet", "latitude": 12.96, "longitude": 77.565},
            {"name": "Chickpet", "address": "Avenue Rd, Chickpet", "latitude": 12.97, "longitude": 77.577},
            {"name": "Seshadripuram", "address": "Seshadri Rd, Seshadripuram", "latitude": 12.993, "longitude": 77.573},
            {"name": "Cunningham Road", "address": "Cunningham Rd, Vasanth Nagar", "latitude": 12.989, "longitude": 77.594},
            {"name": "HAL Airport Road", "address": "Old Airport Rd, HAL 2nd Stage", "latitude": 12.959, "longitude": 77.665},
            {"name": "CV Raman Nagar", "address": "CV Raman Nagar Main Rd", "latitude": 12.985, "longitude": 77.663},
            {"name": "Mahadevapura", "address": "Whitefield Main Rd, Mahadevapura", "latitude": 12.991, "longitude": 77.695},
            {"name": "Brookefield", "address": "ITPL Rd, Brookefield", "latitude": 12.966, "longitude": 77.717},
            {"name": "Varthur", "address": "Varthur Main Rd", "latitude": 12.94, "longitude": 77.747},
            {"name": "Hoodi", "address": "Hoodi Main Rd, Hoodi", "latitude": 12.992, "longitude": 77.716},
            {"name": "Hulimavu", "address": "Bannerghatta Rd, Hulimavu", "latitude": 12.878, "longitude": 77.6},
            {"name": "Begur", "address": "Begur Main Rd, Begur", "latitude": 12.88, "longitude": 77.628},
            {"name": "Agara", "address": "Sarjapur Rd, Agara", "latitude": 12.923, "longitude": 77.648},
            {"name": "Ejipura", "address": "Intermediate Ring Rd, Ejipura", "latitude": 12.944, "longitude": 77.626},
            {"name": "Adugodi", "address": "Hosur Rd, Adugodi", "latitude": 12.943, "longitude": 77.61},
        ]
        extra_added = 0
        for loc_data in extra_locations:
            existing = Location.query.filter_by(name=loc_data["name"]).first()
            if not existing:
                existing = Location(**loc_data)
                db.session.add(existing)
                db.session.flush()
                extra_added += 1
            else:
                existing.address = loc_data["address"]
                existing.latitude = loc_data["latitude"]
                existing.longitude = loc_data["longitude"]
            locations_by_name[existing.name] = existing
        db.session.commit()

        # Two-way road links: (hub_a, hub_b, distance_km, duration_min).
        # Distance = straight-line distance x 1.3 road factor; duration at ~22 km/h city speed.
        extra_roads = [
            # Yelahanka: open roads to its nearest hubs. The direct Majestic -> Yelahanka
            # road stays inactive, so Dijkstra must take the longer open route (inactive-road demo).
            ("Yelahanka", "Jakkur", 3.6, 9.7),
            ("Yelahanka", "Vidyaranyapura", 6.2, 17.0),
            ("Yelahanka", "Thanisandra", 8.3, 22.6),
            ("Adugodi", "Ejipura", 2.3, 6.2),
            ("Adugodi", "Koramangala", 2.3, 6.4),
            ("Adugodi", "Wilson Garden", 2.0, 5.5),
            ("Agara", "Bellandur", 4.0, 10.9),
            ("Agara", "HSR Layout", 1.7, 4.5),
            ("Agara", "Koramangala", 3.8, 10.2),
            ("Agara", "Sarjapur Road", 5.7, 15.5),
            ("Agara", "Silk Board", 3.5, 9.5),
            ("BTM Layout", "Silk Board", 1.9, 5.3),
            ("Banashankari", "Kumaraswamy Layout", 3.6, 9.9),
            ("Banashankari", "RR Nagar", 4.5, 12.2),
            ("Banashankari", "Uttarahalli", 3.0, 8.2),
            ("Banaswadi", "CV Raman Nagar", 4.5, 12.3),
            ("Banaswadi", "Hennur", 3.6, 9.9),
            ("Banaswadi", "Kalyan Nagar", 2.6, 7.1),
            ("Bannerghatta Road", "Begur", 4.6, 12.4),
            ("Bannerghatta Road", "Hulimavu", 1.6, 4.5),
            ("Basavanagudi", "Chamarajpet", 2.9, 7.9),
            ("Basavanagudi", "Lalbagh", 2.0, 5.4),
            ("Basaveshwaranagar", "Malleshwaram", 4.8, 13.0),
            ("Basaveshwaranagar", "Nagarbhavi", 6.3, 17.1),
            ("Basaveshwaranagar", "Peenya", 5.8, 15.8),
            ("Basaveshwaranagar", "Rajajinagar", 1.9, 5.1),
            ("Basaveshwaranagar", "Vijayanagar", 3.3, 9.0),
            ("Begur", "Bommanahalli", 3.4, 9.2),
            ("Begur", "Electronic City", 6.8, 18.5),
            ("Begur", "Hulimavu", 4.0, 10.8),
            ("Bellandur", "HSR Layout", 4.6, 12.4),
            ("Bellandur", "Sarjapur Road", 2.7, 7.3),
            ("Bommanahalli", "Silk Board", 2.1, 5.8),
            ("Brookefield", "Hoodi", 3.8, 10.3),
            ("Brookefield", "Marathahalli", 2.6, 7.1),
            ("Brookefield", "Varthur", 5.7, 15.4),
            ("Brookefield", "Whitefield", 4.7, 12.8),
            ("CV Raman Nagar", "HAL Airport Road", 3.8, 10.3),
            ("CV Raman Nagar", "Indiranagar", 3.3, 8.9),
            ("CV Raman Nagar", "KR Puram", 5.6, 15.2),
            ("CV Raman Nagar", "Mahadevapura", 4.6, 12.5),
            ("Chamarajpet", "Chickpet", 2.2, 6.1),
            ("Chamarajpet", "Majestic Depot", 2.6, 7.0),
            ("Chickpet", "Majestic Depot", 1.3, 3.4),
            ("Chickpet", "Vidhana Soudha", 2.4, 6.5),
            ("Cox Town", "Frazer Town", 1.4, 3.9),
            ("Cox Town", "Shivajinagar", 3.2, 8.6),
            ("Cox Town", "Ulsoor", 2.3, 6.3),
            ("Cunningham Road", "MG Road", 2.5, 6.8),
            ("Cunningham Road", "Shivajinagar", 1.7, 4.7),
            ("Cunningham Road", "Vidhana Soudha", 1.5, 4.0),
            ("Domlur", "Ejipura", 3.0, 8.3),
            ("Domlur", "HAL Airport Road", 3.7, 10.1),
            ("Domlur", "Indiranagar", 2.5, 6.9),
            ("Ejipura", "Koramangala", 1.3, 3.5),
            ("Electronic City", "HSR Layout", 9.8, 26.6),
            ("Electronic City", "Hulimavu", 9.7, 26.5),
            ("Frazer Town", "Shivajinagar", 2.3, 6.3),
            ("Frazer Town", "Ulsoor", 2.6, 7.0),
            ("HAL Airport Road", "Indiranagar", 4.4, 12.0),
            ("HAL Airport Road", "Marathahalli", 5.1, 13.9),
            ("HSR Layout", "Sarjapur Road", 5.4, 14.8),
            ("Hebbal", "Jakkur", 6.2, 17.0),
            ("Hebbal", "Nagawara", 3.3, 9.1),
            ("Hebbal", "Sanjay Nagar", 2.8, 7.7),
            ("Hennur", "Kalyan Nagar", 1.1, 3.1),
            ("Hennur", "Nagawara", 2.8, 7.6),
            ("Hennur", "Thanisandra", 3.0, 8.3),
            ("Hoodi", "KR Puram", 3.7, 10.1),
            ("Hoodi", "Mahadevapura", 3.0, 8.1),
            ("Hulimavu", "JP Nagar", 4.6, 12.4),
            ("JP Nagar", "Kumaraswamy Layout", 3.2, 8.7),
            ("Jakkur", "Nagawara", 5.7, 15.5),
            ("Jakkur", "Thanisandra", 5.0, 13.5),
            ("Jakkur", "Vidyaranyapura", 6.8, 18.4),
            ("Jalahalli", "Mathikere", 3.1, 8.4),
            ("Jalahalli", "Peenya", 4.3, 11.7),
            ("Jalahalli", "Vidyaranyapura", 5.2, 14.3),
            ("Jalahalli", "Yeshwanthpur", 2.6, 7.0),
            ("KR Puram", "Mahadevapura", 2.4, 6.5),
            ("Kalyan Nagar", "Nagawara", 3.4, 9.2),
            ("Kalyan Nagar", "Thanisandra", 4.2, 11.4),
            ("Kengeri", "Nagarbhavi", 8.5, 23.2),
            ("Kengeri", "RR Nagar", 5.4, 14.7),
            ("Kengeri", "Uttarahalli", 8.7, 23.9),
            ("Koramangala", "Silk Board", 2.5, 6.9),
            ("Kumaraswamy Layout", "Uttarahalli", 2.7, 7.3),
            ("Lalbagh", "Richmond Town", 2.9, 7.9),
            ("Lalbagh", "Wilson Garden", 1.7, 4.7),
            ("Mahadevapura", "Marathahalli", 5.0, 13.6),
            ("Majestic Depot", "Seshadripuram", 2.4, 6.5),
            ("Malleshwaram", "Sadashivanagar", 1.5, 4.2),
            ("Malleshwaram", "Seshadripuram", 1.5, 4.2),
            ("Marathahalli", "Varthur", 6.9, 18.9),
            ("Mathikere", "Sanjay Nagar", 2.0, 5.4),
            ("Mathikere", "Vidyaranyapura", 6.7, 18.2),
            ("Mathikere", "Yeshwanthpur", 3.3, 9.1),
            ("Nagarbhavi", "RR Nagar", 4.8, 13.2),
            ("Nagarbhavi", "Vijayanagar", 3.3, 9.0),
            ("Nagawara", "Thanisandra", 2.8, 7.7),
            ("Peenya", "Yeshwanthpur", 2.9, 7.8),
            ("RR Nagar", "Uttarahalli", 5.2, 14.1),
            ("RT Nagar", "Sadashivanagar", 2.8, 7.5),
            ("RT Nagar", "Sanjay Nagar", 3.0, 8.1),
            ("Richmond Town", "Wilson Garden", 2.1, 5.9),
            ("Sadashivanagar", "Seshadripuram", 2.3, 6.3),
            ("Varthur", "Whitefield", 4.3, 11.8),
        ]
        extra_roads_added = 0
        for a_name, b_name, dist, dur in extra_roads:
            a_id, b_id = locations_by_name[a_name].id, locations_by_name[b_name].id
            for src_id, dst_id in ((a_id, b_id), (b_id, a_id)):
                if not Road.query.filter_by(source_location_id=src_id, destination_location_id=dst_id).first():
                    db.session.add(Road(
                        source_location_id=src_id,
                        destination_location_id=dst_id,
                        distance_km=dist,
                        estimated_duration_minutes=dur,
                        is_active=True
                    ))
                    extra_roads_added += 1
        db.session.commit()
        print(f"[*] Extended network: {extra_added} new hubs, {extra_roads_added} new road links (total hubs: {len(locations_by_name)}).")

        # Ensure schema compatibility for delivered_at and customer_email
        try:
            with db.engine.connect() as conn:
                conn.execute(db.text("ALTER TABLE deliveries ADD COLUMN delivered_at DATETIME"))
                conn.commit()
        except Exception:
            pass

        try:
            with db.engine.connect() as conn:
                conn.execute(db.text("ALTER TABLE deliveries ADD COLUMN customer_email VARCHAR(120)"))
                conn.commit()
        except Exception:
            pass

        # Clean up legacy demo tracking numbers if present
        legacy_count = Delivery.query.filter(Delivery.tracking_number.like('TRK-DEMO-%')).delete(synchronize_session=False)
        if legacy_count > 0:
            db.session.commit()
            print(f"[*] Cleaned up {legacy_count} legacy demo deliveries.")

        # 3. Seed Deliveries (Consignment Manifests)
        # Deterministic generation of 60 deliveries spread over the last 30 days
        import random
        random.seed(42)

        customer_names = [
            "Apex Medical Supplies", "Pacific Tech Systems", "Bayview Marine Imports",
            "Metro Superstore Central", "Greenleaf Bio Pharma", "Starlight Electronics",
            "OmniRetail Distribution", "Horizon Robotics Lab", "SF General Health Center",
            "Golden Gate Commerce", "Civic Dispatch Supplies", "Mission Craft Brewery",
            "SoMa Software Park", "Embarcadero Provisions", "Presidio Bioscience Inc",
            "Richmond Fresh Produce", "Sunset Hardware Goods", "Marina Gourmet Foods",
            "Potrero Precision Tools", "Dogpatch Industrial Logistics", "Twin Peaks Telecom",
            "Bernal Heights Organic", "Excelsior Parcel Depot", "Financial District Law Corp"
        ]

        drivers = [
            "Marcus Vance (Van 04)", "Elena Rostova (Van 02)", "David Kim (Truck 01)",
            "Sarah Jenkins (Van 01)", "Carlos Mendez (Van 03)", "Aisha Patel (Truck 02)"
        ]

        # 60 deliveries with realistic status distribution:
        # ~55% Delivered (33), ~20% In Transit (12), ~15% Pending (9), ~10% Delayed (6)
        statuses = ['Delivered'] * 33 + ['In Transit'] * 12 + ['Pending'] * 9 + ['Delayed'] * 6
        random.shuffle(statuses)

        now = datetime.datetime.now(datetime.timezone.utc)
        hub_list = [locations_by_name[loc["name"]] for loc in sample_locations]  # core 24 hubs only
        depot_loc = locations_by_name.get("Majestic Depot", hub_list[0])

        deliveries_added = 0
        deliveries_updated = 0

        for i in range(60):
            tracking_no = f"SR-2026-{i+1:04d}"
            status = statuses[i]

            # Choose realistic pickup and destination
            if i % 3 == 0:
                pickup = depot_loc
                dest_candidates = [h for h in hub_list if h.id != pickup.id]
                dest = random.choice(dest_candidates)
            else:
                p_idx = random.randrange(len(hub_list))
                d_idx = (p_idx + random.randint(1, len(hub_list) - 1)) % len(hub_list)
                pickup = hub_list[p_idx]
                dest = hub_list[d_idx]

            # Spread created_at over the last 30 days
            # Delivered orders are distributed across days 1 to 29 ago
            # In Transit are from the last 1 to 3 days
            # Pending are from the last 1 to 2 days
            # Delayed are from days 3 to 7 ago
            if status == 'Delivered':
                days_ago = random.randint(1, 29)
                hours_ago = random.randint(0, 23)
                minutes_ago = random.randint(0, 59)
                created_dt = now - datetime.timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
                delivery_dt = created_dt.date()
                delivered_dt = created_dt + datetime.timedelta(hours=random.randint(1, 8), minutes=random.randint(5, 55))
                driver = random.choice(drivers)
            elif status == 'In Transit':
                days_ago = random.randint(0, 2)
                hours_ago = random.randint(2, 18)
                minutes_ago = random.randint(0, 59)
                created_dt = now - datetime.timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
                delivery_dt = created_dt.date()
                delivered_dt = None
                driver = random.choice(drivers)
            elif status == 'Pending':
                days_ago = random.randint(0, 1)
                hours_ago = random.randint(0, 12)
                minutes_ago = random.randint(0, 59)
                created_dt = now - datetime.timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
                delivery_dt = created_dt.date()
                delivered_dt = None
                driver = "Unassigned"
            else:  # Delayed
                days_ago = random.randint(3, 7)
                hours_ago = random.randint(4, 20)
                minutes_ago = random.randint(0, 59)
                created_dt = now - datetime.timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
                delivery_dt = created_dt.date()
                delivered_dt = None
                driver = random.choice(drivers)

            priority = random.choice(["Standard", "Express", "Urgent"])
            dist = round(random.uniform(2.5, 24.0), 2)
            weight = round(random.uniform(0.8, 48.0), 2)
            time_slot = random.choice(["09:30 AM", "10:45 AM", "11:30 AM", "01:15 PM", "02:45 PM", "04:15 PM", "05:30 PM"])
            customer = customer_names[i % len(customer_names)]

            if i < 6:
                customer_email = "viewer@smartroute.pro"
            else:
                customer_email = f"client_{(i % 12) + 1}@logistics-partner.com"

            existing = Delivery.query.filter_by(tracking_number=tracking_no).first()
            if not existing:
                delivery = Delivery(
                    tracking_number=tracking_no,
                    customer_name=customer,
                    customer_email=customer_email,
                    pickup_location_id=pickup.id,
                    destination_location_id=dest.id,
                    delivery_date=delivery_dt,
                    priority=priority,
                    status=status,
                    distance_km=dist,
                    package_weight_kg=weight,
                    estimated_delivery_time=time_slot,
                    assigned_driver=driver,
                    delivered_at=delivered_dt,
                    created_at=created_dt,
                    updated_at=delivered_dt or created_dt
                )
                db.session.add(delivery)
                deliveries_added += 1
            else:
                existing.customer_name = customer
                existing.customer_email = customer_email
                existing.pickup_location_id = pickup.id
                existing.destination_location_id = dest.id
                existing.delivery_date = delivery_dt
                existing.priority = priority
                existing.status = status
                existing.distance_km = dist
                existing.package_weight_kg = weight
                existing.estimated_delivery_time = time_slot
                existing.assigned_driver = driver
                existing.delivered_at = delivered_dt
                existing.created_at = created_dt
                existing.updated_at = delivered_dt or created_dt
                deliveries_updated += 1

        db.session.commit()
        print(f"[*] Deliveries: {deliveries_added} new sample deliveries added, {deliveries_updated} updated.")

        # 4. Seed Users (Admin always; Demo Dispatcher & Viewer when configured)
        admin_email = os.getenv('ADMIN_EMAIL', app.config.get('ADMIN_EMAIL', 'admin@smartroute.pro')).strip().lower()
        admin_pwd = os.getenv('INITIAL_ADMIN_PASSWORD') or os.getenv('ADMIN_PASSWORD') or app.config.get('INITIAL_ADMIN_PASSWORD')
        if not admin_pwd or admin_pwd == 'change-me':
            admin_pwd = 'Admin@123456'

        if admin_pwd:
            admin = User.query.filter_by(email=admin_email).first()
            if not admin:
                admin = User(
                    name="System Administrator",
                    email=admin_email,
                    role="ADMIN",
                    approval_status="approved",
                    is_active=True
                )
                admin.set_password(admin_pwd)
                db.session.add(admin)
                print(f"[*] Created admin account: {admin_email}")
            else:
                admin.role = "ADMIN"
                admin.approval_status = "approved"
                admin.is_active = True
                admin.set_password(admin_pwd)
                print(f"[*] Synchronized admin account: {admin_email}")

        # Seed demo users if explicitly requested or in non-production environments
        seed_demo = os.getenv('SEED_DEMO_USERS', '').lower() in ('true', '1', 'yes') or env_name != 'production'
        if seed_demo:
            disp_email = os.getenv('DISPATCHER_EMAIL', 'dispatcher@smartroute.pro').strip().lower()
            disp_pwd = os.getenv('DEMO_DISPATCHER_PASSWORD') or os.getenv('DISPATCHER_PASSWORD')
            if not disp_pwd or disp_pwd == 'change-me':
                disp_pwd = 'Dispatch@123456'

            disp = User.query.filter_by(email=disp_email).first()
            if not disp:
                disp = User(
                    name="Senior Logistics Dispatcher",
                    email=disp_email,
                    role="DISPATCHER",
                    approval_status="approved",
                    is_active=True
                )
                disp.set_password(disp_pwd)
                db.session.add(disp)
                print(f"[*] Created demo dispatcher account: {disp_email}")
            else:
                disp.role = "DISPATCHER"
                disp.approval_status = "approved"
                disp.is_active = True
                disp.set_password(disp_pwd)
                print(f"[*] Synchronized demo dispatcher account: {disp_email}")

            viewer_email = os.getenv('VIEWER_EMAIL', 'viewer@smartroute.pro').strip().lower()
            viewer_pwd = os.getenv('DEMO_VIEWER_PASSWORD') or os.getenv('VIEWER_PASSWORD')
            if not viewer_pwd or viewer_pwd == 'change-me':
                viewer_pwd = 'Viewer@123456'

            viewer = User.query.filter_by(email=viewer_email).first()
            if not viewer:
                viewer = User(
                    name="Viewer User",
                    email=viewer_email,
                    role="VIEWER",
                    approval_status="approved",
                    is_active=True
                )
                viewer.set_password(viewer_pwd)
                db.session.add(viewer)
                print(f"[*] Created demo viewer account: {viewer_email}")
            else:
                viewer.role = "VIEWER"
                viewer.approval_status = "approved"
                viewer.is_active = True
                viewer.set_password(viewer_pwd)
                print(f"[*] Synchronized demo viewer account: {viewer_email}")
        else:
            print("[*] Production mode without SEED_DEMO_USERS: skipping demo accounts creation.")

        # Seed initial cluster run if none exists so Delivery Zones and Route Planner ZonePicker have zones available
        if not ClusterRun.query.first():
            loc_objs = Location.query.all()
            if len(loc_objs) >= 3:
                from app.services.clustering import KMeansClusterEngine
                loc_dicts = [loc.to_dict() for loc in loc_objs]
                k = min(4, len(loc_objs))
                res = KMeansClusterEngine.fit(loc_dicts, k=k, max_iter=100, random_state=42)
                cr = ClusterRun(
                    k=res['k'],
                    max_iterations=res['max_iterations'],
                    random_state=res['random_state'],
                    inertia=res['inertia'],
                    silhouette_score=res['silhouette_score'],
                    iterations_run=res['iterations_run'],
                    total_locations=res['total_locations'],
                    centroids_json=json.dumps(res['centroids']),
                    execution_time_ms=res['execution_time_ms']
                )
                db.session.add(cr)
                db.session.flush()
                for item in res['assignments']:
                    ca = ClusterAssignment(
                        cluster_run_id=cr.id,
                        location_id=item['location_id'],
                        cluster_id=item['cluster_id'],
                        distance_to_centroid_km=item['distance_to_centroid_km']
                    )
                    db.session.add(ca)
                print(f"[*] Seeded initial cluster run with {k} zones.")

        db.session.commit()
        print("[OK] Database seeding completed successfully.")

if __name__ == '__main__':
    seed_database()
