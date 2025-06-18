#!/usr/bin/env python3
"""
Train Delay Monitor Startup Script
Run this script to start monitoring train delays for Gothenburg arrivals.
"""

import sys
import os
import signal
from datetime import datetime

# Add current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from train_delay_monitor import TrainDelayMonitor
from train_api import TrainDelayAPI, create_simple_api_server

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    print('\nShutting down train monitor...')
    sys.exit(0)

def run_monitor_only():
    """Run just the monitor without API server"""
    print("=== Train Delay Monitor for Gothenburg ===")
    print(f"Started at: {datetime.now()}")
    print("Monitoring arrivals to Gothenburg Central Station")
    print("Press Ctrl+C to stop\n")
    
    monitor = TrainDelayMonitor()
    
    try:
        # Do initial update
        print("Performing initial data fetch...")
        monitor.update_data()
        
        # Start continuous monitoring
        monitor_thread = monitor.start_monitoring(interval_minutes=1)
        
        # Keep the main thread alive
        monitor_thread.join()
        
    except KeyboardInterrupt:
        print("\nStopping monitor...")
        monitor.stop_monitoring()

def run_with_api_server(port=8000):
    """Run monitor with API server for web integration"""
    print("=== Train Delay Monitor with API Server ===")
    print(f"Started at: {datetime.now()}")
    print("Monitoring arrivals to Gothenburg Central Station")
    print(f"API Server will run on http://localhost:{port}")
    print("Press Ctrl+C to stop\n")
    
    try:
        server, api = create_simple_api_server(port)
        
        # Start auto-update with 2-minute interval
        api.start_auto_update(2)
        
        print(f"API Server running on http://localhost:{port}")
        print("Available endpoints:")
        print("  GET /api/trains - Get all current trains")
        print("  GET /api/trains/delayed - Get only delayed trains") 
        print("  GET /api/summary - Get summary statistics")
        print("  GET /api/train?number=XXXX - Get specific train")
        print("  GET /api/update - Force immediate data update")
        print("\nServer is ready! You can now integrate with your webpage.")
        print("Press Ctrl+C to stop the server\n")
        
        server.serve_forever()
        
    except KeyboardInterrupt:
        print("\nShutting down server...")
        api.stop_auto_update()
        server.shutdown()

def test_api():
    """Test the API functionality"""
    print("=== Testing Train Delay API ===")
    
    monitor = TrainDelayMonitor()
    
    print("1. Fetching current train data...")
    monitor.update_data()
    
    print("2. Getting delay summary...")
    summary = monitor.get_delay_summary()
    
    print("\nTest Results:")
    print(f"Total trains: {summary.get('total_trains', 0)}")
    print(f"Delayed trains: {summary.get('delayed_trains', 0)}")
    print(f"Early trains: {summary.get('early_trains', 0)}")
    print(f"Canceled trains: {summary.get('canceled_trains', 0)}")
    print(f"Replaced trains: {summary.get('replaced_trains', 0)}")
    
    # Show some train data
    df = monitor.get_current_delays()
    if not df.empty:
        print(f"\nSample train data (showing first 5 trains):")
        print(df[['AdvertisedTrainIdent', 'AdvertisedTimeAtLocation', 'DelayMinutes', 'DelayStatus']].head().to_string(index=False))
    
    print("\nAPI test completed!")

def show_help():
    """Show help information"""
    print("Train Delay Monitor - Usage:")
    print("  python run_train_monitor.py                 - Run monitor only")
    print("  python run_train_monitor.py --api           - Run with API server") 
    print("  python run_train_monitor.py --api --port 8001 - Run API on specific port")
    print("  python run_train_monitor.py --test          - Test API functionality")
    print("  python run_train_monitor.py --help          - Show this help")
    print("\nThe monitor fetches train data every minute and tracks delays for")
    print("arrivals to Gothenburg Central Station (location signature 'G').")

def main():
    """Main function"""
    # Handle Ctrl+C gracefully
    signal.signal(signal.SIGINT, signal_handler)
    
    # Parse command line arguments
    args = sys.argv[1:]
    
    if '--help' in args or '-h' in args:
        show_help()
        return
    
    if '--test' in args:
        test_api()
        return
    
    if '--api' in args:
        port = 8000
        if '--port' in args:
            try:
                port_index = args.index('--port') + 1
                port = int(args[port_index])
            except (IndexError, ValueError):
                print("Invalid port number. Using default port 8000.")
                port = 8000
        
        run_with_api_server(port)
    else:
        run_monitor_only()

if __name__ == "__main__":
    main() 