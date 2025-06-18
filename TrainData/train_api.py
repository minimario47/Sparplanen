from train_delay_monitor import TrainDelayMonitor
import json
import os
from datetime import datetime
from typing import Dict, List
import threading
import time

class TrainDelayAPI:
    def __init__(self):
        self.monitor = TrainDelayMonitor()
        self.monitor_thread = None
        self.auto_update_running = False
        
    def start_auto_update(self, interval_minutes: int = 1):
        """Start automatic data updates in background"""
        if not self.auto_update_running:
            self.monitor_thread = self.monitor.start_monitoring(interval_minutes)
            self.auto_update_running = True
            print(f"Auto-update started with {interval_minutes} minute interval")
    
    def stop_auto_update(self):
        """Stop automatic data updates"""
        if self.auto_update_running:
            self.monitor.stop_monitoring()
            self.auto_update_running = False
            print("Auto-update stopped")
    
    def get_current_delays_json(self) -> str:
        """Get current delay data as JSON string"""
        df = self.monitor.get_current_delays()
        if df.empty:
            return json.dumps({"trains": [], "summary": {}, "last_updated": None})
        
        # Convert DataFrame to list of dictionaries
        trains = df.to_dict('records')
        
        # Clean up NaN values for JSON serialization
        for train in trains:
            for key, value in train.items():
                if str(value) == 'nan' or value is None:
                    train[key] = None
        
        summary = self.monitor.get_delay_summary()
        
        result = {
            "trains": trains,
            "summary": summary,
            "last_updated": datetime.now().isoformat(),
            "total_count": len(trains)
        }
        
        return json.dumps(result, ensure_ascii=False, indent=2)
    
    def get_delayed_trains_only_json(self) -> str:
        """Get only trains with significant delays as JSON"""
        df = self.monitor.get_current_delays()
        if df.empty:
            return json.dumps({"trains": [], "count": 0})
        
        # Filter for trains with delays > 2 minutes, canceled, or replaced
        delayed_df = df[
            (df['DelayMinutes'].abs() > 2) | 
            (df['IsCanceled'] == True) | 
            (df['IsReplaced'] == True)
        ]
        
        trains = delayed_df.to_dict('records')
        
        # Clean up NaN values
        for train in trains:
            for key, value in train.items():
                if str(value) == 'nan' or value is None:
                    train[key] = None
        
        result = {
            "trains": trains,
            "count": len(trains),
            "last_updated": datetime.now().isoformat()
        }
        
        return json.dumps(result, ensure_ascii=False, indent=2)
    
    def get_summary_json(self) -> str:
        """Get summary statistics as JSON"""
        summary = self.monitor.get_delay_summary()
        summary["last_updated"] = datetime.now().isoformat()
        return json.dumps(summary, ensure_ascii=False, indent=2)
    
    def force_update(self) -> Dict:
        """Force an immediate update and return status"""
        try:
            self.monitor.update_data()
            return {
                "status": "success", 
                "message": "Data updated successfully",
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "status": "error", 
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def get_train_by_number(self, train_number: str) -> str:
        """Get specific train by its advertised train identifier"""
        df = self.monitor.get_current_delays()
        if df.empty:
            return json.dumps({"train": None, "found": False})
        
        train_df = df[df['AdvertisedTrainIdent'] == train_number]
        
        if train_df.empty:
            return json.dumps({"train": None, "found": False})
        
        train = train_df.iloc[0].to_dict()
        
        # Clean up NaN values
        for key, value in train.items():
            if str(value) == 'nan' or value is None:
                train[key] = None
        
        result = {
            "train": train,
            "found": True,
            "last_updated": datetime.now().isoformat()
        }
        
        return json.dumps(result, ensure_ascii=False, indent=2)


# Create simple HTTP server functions for your webpage to call
def create_simple_api_server(port: int = 8000):
    """Create a simple HTTP server to serve train data"""
    from http.server import HTTPServer, BaseHTTPRequestHandler
    import urllib.parse
    
    api = TrainDelayAPI()
    
    class TrainAPIHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            # Parse the URL
            parsed_path = urllib.parse.urlparse(self.path)
            path = parsed_path.path
            query_params = urllib.parse.parse_qs(parsed_path.query)
            
            # Set CORS headers
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            
            try:
                if path == '/api/trains':
                    response = api.get_current_delays_json()
                elif path == '/api/trains/delayed':
                    response = api.get_delayed_trains_only_json()
                elif path == '/api/summary':
                    response = api.get_summary_json()
                elif path == '/api/train':
                    train_number = query_params.get('number', [''])[0]
                    if train_number:
                        response = api.get_train_by_number(train_number)
                    else:
                        response = json.dumps({"error": "Train number required"})
                elif path == '/api/update':
                    result = api.force_update()
                    response = json.dumps(result)
                elif path == '/api/start':
                    interval = int(query_params.get('interval', ['1'])[0])
                    api.start_auto_update(interval)
                    response = json.dumps({"status": "started", "interval": interval})
                elif path == '/api/stop':
                    api.stop_auto_update()
                    response = json.dumps({"status": "stopped"})
                else:
                    response = json.dumps({
                        "error": "Unknown endpoint",
                        "available_endpoints": [
                            "/api/trains - Get all trains",
                            "/api/trains/delayed - Get delayed trains only",
                            "/api/summary - Get summary statistics",
                            "/api/train?number=XXXX - Get specific train",
                            "/api/update - Force data update",
                            "/api/start?interval=1 - Start auto-update",
                            "/api/stop - Stop auto-update"
                        ]
                    })
                
                self.wfile.write(response.encode('utf-8'))
                
            except Exception as e:
                error_response = json.dumps({"error": str(e)})
                self.wfile.write(error_response.encode('utf-8'))
        
        def do_OPTIONS(self):
            # Handle preflight requests
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
        
        def log_message(self, format, *args):
            # Override to reduce console output
            pass
    
    return HTTPServer(('localhost', port), TrainAPIHandler), api


# JavaScript code that your webpage can use
def generate_webpage_js_code() -> str:
    """Generate JavaScript code for your webpage to use the train API"""
    js_code = """
// Train Delay API Client for your webpage
class TrainDelayClient {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
    }
    
    async getAllTrains() {
        try {
            const response = await fetch(`${this.baseUrl}/api/trains`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching trains:', error);
            return null;
        }
    }
    
    async getDelayedTrains() {
        try {
            const response = await fetch(`${this.baseUrl}/api/trains/delayed`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching delayed trains:', error);
            return null;
        }
    }
    
    async getSummary() {
        try {
            const response = await fetch(`${this.baseUrl}/api/summary`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching summary:', error);
            return null;
        }
    }
    
    async getTrain(trainNumber) {
        try {
            const response = await fetch(`${this.baseUrl}/api/train?number=${trainNumber}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching train:', error);
            return null;
        }
    }
    
    async forceUpdate() {
        try {
            const response = await fetch(`${this.baseUrl}/api/update`);
            return await response.json();
        } catch (error) {
            console.error('Error forcing update:', error);
            return null;
        }
    }
    
    async startAutoUpdate(intervalMinutes = 1) {
        try {
            const response = await fetch(`${this.baseUrl}/api/start?interval=${intervalMinutes}`);
            return await response.json();
        } catch (error) {
            console.error('Error starting auto-update:', error);
            return null;
        }
    }
    
    async stopAutoUpdate() {
        try {
            const response = await fetch(`${this.baseUrl}/api/stop`);
            return await response.json();
        } catch (error) {
            console.error('Error stopping auto-update:', error);
            return null;
        }
    }
}

// Example usage:
const trainAPI = new TrainDelayClient();

// Get all trains
trainAPI.getAllTrains().then(data => {
    if (data && data.trains) {
        console.log(`Found ${data.trains.length} trains`);
        // Process train data here
    }
});

// Get only delayed trains
trainAPI.getDelayedTrains().then(data => {
    if (data && data.trains) {
        console.log(`Found ${data.count} delayed trains`);
        // Display delayed trains
    }
});

// Get summary
trainAPI.getSummary().then(data => {
    if (data) {
        console.log(`Total: ${data.total_trains}, Delayed: ${data.delayed_trains}`);
        // Update your UI with summary
    }
});
"""
    return js_code


def main():
    """Main function to start the API server"""
    print("Starting Train Delay API Server...")
    
    server, api = create_simple_api_server(8000)
    
    # Start auto-update immediately
    api.start_auto_update(1)  # Update every minute
    
    print("Server running on http://localhost:8000")
    print("Available endpoints:")
    print("  GET /api/trains - Get all trains")
    print("  GET /api/trains/delayed - Get delayed trains only") 
    print("  GET /api/summary - Get summary statistics")
    print("  GET /api/train?number=XXXX - Get specific train")
    print("  GET /api/update - Force data update")
    print("  GET /api/start?interval=1 - Start auto-update")
    print("  GET /api/stop - Stop auto-update")
    print("\nPress Ctrl+C to stop the server")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        api.stop_auto_update()
        server.shutdown()

if __name__ == "__main__":
    main() 