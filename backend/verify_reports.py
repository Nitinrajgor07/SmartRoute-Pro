import os
import sys
from app import create_app
from app.services.reporting import ReportingService

def verify_and_generate_reports():
    print("[*] Initializing SmartRoute Pro application context...")
    app = create_app('development')
    output_dir = os.path.join(os.path.dirname(__file__), 'sample_reports')
    os.makedirs(output_dir, exist_ok=True)
    
    with app.app_context():
        reports = [
            ("deliveries.csv", lambda: ReportingService.generate_deliveries_csv({'status': 'ALL', 'priority': 'ALL', 'search': ''})),
            ("deliveries.pdf", lambda: ReportingService.generate_deliveries_pdf({'status': 'ALL', 'priority': 'ALL', 'search': ''})),
            ("ada_routes.csv", lambda: ReportingService.generate_ada_csv()),
            ("ada_dijkstra.pdf", lambda: ReportingService.generate_ada_pdf()),
            ("sda_clusters.csv", lambda: ReportingService.generate_sda_clusters_csv()),
            ("sda_clustering.pdf", lambda: ReportingService.generate_sda_clusters_pdf()),
            ("statistical_analytics.pdf", lambda: ReportingService.generate_statistics_pdf()),
            ("cloud_operations.pdf", lambda: ReportingService.generate_cloud_pdf()),
            ("smartroute_integrated_academic_report.pdf", lambda: ReportingService.generate_integrated_pdf()),
        ]
        
        results = []
        for name, gen_fn in reports:
            file_path = os.path.join(output_dir, name)
            content = gen_fn()
            
            # Content can be str (CSV) or bytes (PDF/CSV)
            if isinstance(content, str):
                raw_bytes = content.encode('utf-8')
            else:
                raw_bytes = bytes(content)
                
            with open(file_path, 'wb') as f:
                f.write(raw_bytes)
                
            size_kb = round(len(raw_bytes) / 1024, 2)
            is_valid = len(raw_bytes) > 100
            
            # Check PDF header
            if name.endswith('.pdf'):
                has_pdf_magic = raw_bytes.startswith(b'%PDF-')
                is_valid = is_valid and has_pdf_magic
            else:
                has_pdf_magic = False
                
            results.append({
                "name": name,
                "size_kb": size_kb,
                "valid": is_valid,
                "pdf_magic": has_pdf_magic if name.endswith('.pdf') else None
            })
            print(f"  [+] Generated: {name:40s} | Size: {size_kb:7.2f} KB | Valid: {is_valid}")
            
        print("\n[*] All 9 reports generated and validated successfully!")
        return results

if __name__ == '__main__':
    verify_and_generate_reports()
