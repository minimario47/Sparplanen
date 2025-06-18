import requests
import json
import csv
import pandas as pd
from datetime import datetime, timedelta
import xml.etree.ElementTree as ET
import time
import threading
import os
from typing import Dict, List, Optional, Tuple

class TrainDelayMonitor:
    def __init__(self, api_key: str = "5de4a8d180e045fbb63fa7a32a7d6af9"):
        self.api_key = api_key
        self.api_url = "https://api.trafikinfo.trafikverket.se/v2/data.json"
        self.location_signature = "G"  # Gothenburg
        self.running = False
        self.data_file = "TrainData/current_train_delays.csv"
        self.history_file = "TrainData/train_delays_history.csv"
        
        os.makedirs("TrainData", exist_ok=True)
        
        self._initialize_csv_files()
    
    def _initialize_csv_files(self):
        """Initialize CSV files with proper headers if they don't exist"""
        headers = [
            'ActivityId', 'AdvertisedTrainIdent', 'AdvertisedTimeAtLocation', 
            'EstimatedTimeAtLocation', 'TimeAtLocation', 'DelayMinutes', 
            'DelayStatus', 'IsCanceled', 'IsReplaced', 'DeviationDescription', 
            'FromLocation', 'TrackAtLocation', 'ProductDescription', 
            'OperationalTrainNumber', 'LastUpdated', 'DataFreshness'
        ]
        
        for file_path in [self.data_file, self.history_file]:
            if not os.path.exists(file_path):
                with open(file_path, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow(headers)
    
    def _build_api_request(self, start_date: str, end_date: str) -> str:
        """Build XML request for the API"""
        return f"""
        <REQUEST>
            <LOGIN authenticationkey="{self.api_key}"/>
            <QUERY objecttype="TrainAnnouncement" schemaversion="1.9">
                <FILTER>
                    <AND>
                        <EQ name="LocationSignature" value="{self.location_signature}"/>
                        <EQ name="ActivityType" value="Ankomst"/>
                        <AND>
                            <GTE name="AdvertisedTimeAtLocation" value="{start_date}"/>
                            <LT name="AdvertisedTimeAtLocation" value="{end_date}"/>
                        </AND>
                    </AND>
                </FILTER>
            </QUERY>
        </REQUEST>
        """
    
    def fetch_train_data(self, hours_ahead: int = 6, hours_back: int = 3) -> Optional[List[Dict]]:
        """Fetch train announcement data from the API"""
        try:
            # Get current time and time range
            # Include hours_back to catch delayed trains whose scheduled time has passed
            now = datetime.now()
            start_date = (now - timedelta(hours=hours_back)).strftime("%Y-%m-%dT%H:%M:%S")
            end_date = (now + timedelta(hours=hours_ahead)).strftime("%Y-%m-%dT%H:%M:%S")
            
            xml_request = self._build_api_request(start_date, end_date)
            
            print(f"Fetching trains from {start_date} to {end_date}")
            
            headers = {
                'Content-Type': 'text/xml; charset=utf-8'
            }
            
            response = requests.post(self.api_url, data=xml_request.strip(), headers=headers)
            response.raise_for_status()
            
            data = response.json()
            
            # Extract train announcements
            train_announcements = []
            if 'RESPONSE' in data and 'RESULT' in data['RESPONSE']:
                for result in data['RESPONSE']['RESULT']:
                    if 'TrainAnnouncement' in result:
                        train_announcements.extend(result['TrainAnnouncement'])
            
            print(f"Fetched {len(train_announcements)} train announcements at {datetime.now()}")
            return train_announcements
            
        except requests.exceptions.RequestException as e:
            print(f"API request failed: {e}")
            return None
        except Exception as e:
            print(f"Error fetching train data: {e}")
            return None
    
    def _parse_datetime(self, datetime_str: str) -> Optional[datetime]:
        """Parse datetime string from API response"""
        if not datetime_str:
            return None
        try:
            # Handle different datetime formats from API
            if datetime_str.endswith('+02:00'):
                return datetime.fromisoformat(datetime_str.replace('+02:00', ''))
            elif datetime_str.endswith('+01:00'):
                return datetime.fromisoformat(datetime_str.replace('+01:00', ''))
            else:
                return datetime.fromisoformat(datetime_str.split('.')[0])
        except:
            return None
    
    def _calculate_delay(self, advertised_time: str, estimated_time: str, actual_time: str) -> Tuple[Optional[int], str]:
        """Calculate delay in minutes and determine delay status"""
        advertised_dt = self._parse_datetime(advertised_time)
        if not advertised_dt:
            return None, "NO_SCHEDULE"
        
        # Use actual time if available, otherwise estimated time
        comparison_time = actual_time if actual_time else estimated_time
        comparison_dt = self._parse_datetime(comparison_time)
        
        if not comparison_dt:
            return None, "NO_ESTIMATE"
        
        # Calculate delay in minutes
        delay_minutes = int((comparison_dt - advertised_dt).total_seconds() / 60)
        
        # Determine delay status based on threshold
        if delay_minutes > 2:
            return delay_minutes, f"DELAYED"
        elif delay_minutes < -2:
            return delay_minutes, f"EARLY"
        else:
            return delay_minutes, "ON_TIME"
    
    def _extract_location_name(self, location_list: str) -> str:
        """Extract location name from location list string"""
        if not location_list:
            return ""
        try:
            # Parse the string representation of list
            import ast
            locations = ast.literal_eval(location_list)
            if locations and isinstance(locations, list) and len(locations) > 0:
                return locations[0].get('LocationName', '')
        except:
            pass
        return ""
    
    def _extract_deviation_info(self, deviation_str: str, canceled: bool) -> Tuple[bool, str]:
        """Extract deviation information and replacement status"""
        is_replaced = False
        deviation_desc = ""
        
        if canceled:
            return False, "CANCELED"
        
        if not deviation_str:
            return False, ""
        
        try:
            import ast
            deviations = ast.literal_eval(deviation_str)
            if deviations and isinstance(deviations, list):
                descriptions = []
                for dev in deviations:
                    if isinstance(dev, dict) and 'Description' in dev:
                        desc = dev['Description']
                        descriptions.append(desc)
                        if 'ersätter' in desc.lower() or 'buss' in desc.lower():
                            is_replaced = True
                deviation_desc = '; '.join(descriptions)
        except:
            deviation_desc = str(deviation_str)
        
        return is_replaced, deviation_desc
    
    def _extract_product_description(self, product_info_str: str) -> str:
        """Extract product description"""
        if not product_info_str:
            return ""
        try:
            import ast
            products = ast.literal_eval(product_info_str)
            if products and isinstance(products, list) and len(products) > 0:
                return products[0].get('Description', '')
        except:
            pass
        return ""
    
    def process_train_data(self, raw_data: List[Dict]) -> List[Dict]:
        """Process raw train data and calculate delays"""
        processed_data = []
        current_time = datetime.now()
        
        for train in raw_data:
            # Skip trains that have already arrived more than 1 hour ago
            actual_time = train.get('TimeAtLocation', '')
            if actual_time:
                actual_dt = self._parse_datetime(actual_time)
                if actual_dt and (current_time - actual_dt).total_seconds() > 3600:  # 1 hour
                    continue
            # Extract basic information
            activity_id = train.get('ActivityId', '')
            train_ident = train.get('AdvertisedTrainIdent', '')
            advertised_time = train.get('AdvertisedTimeAtLocation', '')
            estimated_time = train.get('EstimatedTimeAtLocation', '')
            actual_time = train.get('TimeAtLocation', '')
            canceled = train.get('Canceled', False)
            track = train.get('TrackAtLocation', '')
            operational_number = train.get('OperationalTrainNumber', '')
            
            # Extract location and product information
            from_location = self._extract_location_name(str(train.get('FromLocation', '')))
            product_desc = self._extract_product_description(str(train.get('ProductInformation', '')))
            
            # Calculate delay
            delay_minutes, delay_status = self._calculate_delay(advertised_time, estimated_time, actual_time)
            
            # Extract deviation information
            is_replaced, deviation_desc = self._extract_deviation_info(
                str(train.get('Deviation', '')), canceled
            )
            
            # Determine data freshness
            advertised_dt = self._parse_datetime(advertised_time)
            data_freshness = "UNKNOWN"
            if advertised_dt:
                time_until_arrival = (advertised_dt - current_time).total_seconds() / 60
                if actual_time:
                    data_freshness = "ARRIVED"
                elif time_until_arrival < 0:
                    data_freshness = "OVERDUE"
                elif time_until_arrival < 30:
                    data_freshness = "IMMINENT"
                elif time_until_arrival < 120:
                    data_freshness = "UPCOMING"
                else:
                    data_freshness = "SCHEDULED"
            
            processed_train = {
                'ActivityId': activity_id,
                'AdvertisedTrainIdent': train_ident,
                'AdvertisedTimeAtLocation': advertised_time,
                'EstimatedTimeAtLocation': estimated_time,
                'TimeAtLocation': actual_time,
                'DelayMinutes': delay_minutes,
                'DelayStatus': delay_status,
                'IsCanceled': canceled,
                'IsReplaced': is_replaced,
                'DeviationDescription': deviation_desc,
                'FromLocation': from_location,
                'TrackAtLocation': track,
                'ProductDescription': product_desc,
                'OperationalTrainNumber': operational_number,
                'LastUpdated': current_time.isoformat(),
                'DataFreshness': data_freshness
            }
            
            processed_data.append(processed_train)
        
        return processed_data
    
    def save_current_data(self, processed_data: List[Dict]):
        """Save current data to CSV file"""
        if not processed_data:
            return
        
        # Sort by advertised time
        processed_data.sort(key=lambda x: x['AdvertisedTimeAtLocation'])
        
        with open(self.data_file, 'w', newline='', encoding='utf-8') as f:
            if processed_data:
                writer = csv.DictWriter(f, fieldnames=processed_data[0].keys())
                writer.writeheader()
                writer.writerows(processed_data)
    
    def append_to_history(self, processed_data: List[Dict]):
        """Append new data to history file"""
        if not processed_data:
            return
        
        # Check if history file exists and has data
        file_exists = os.path.exists(self.history_file) and os.path.getsize(self.history_file) > 0
        
        with open(self.history_file, 'a', newline='', encoding='utf-8') as f:
            if processed_data:
                writer = csv.DictWriter(f, fieldnames=processed_data[0].keys())
                if not file_exists:
                    writer.writeheader()
                writer.writerows(processed_data)
    
    def update_data(self):
        """Single update cycle - fetch and process data"""
        print(f"Updating train data at {datetime.now()}")
        
        # Fetch raw data
        raw_data = self.fetch_train_data()
        if raw_data:
            # Process data
            processed_data = self.process_train_data(raw_data)
            
            # Save current data
            self.save_current_data(processed_data)
            
            # Append to history (only trains with delays or issues)
            significant_data = [
                train for train in processed_data 
                if (train['DelayMinutes'] is not None and abs(train['DelayMinutes']) > 2) 
                or train['IsCanceled'] 
                or train['IsReplaced']
            ]
            self.append_to_history(significant_data)
            
            print(f"Processed {len(processed_data)} trains, {len(significant_data)} with significant delays/issues")
            
            # Print summary of delays
            delays = [t for t in processed_data if t['DelayStatus'] == 'DELAYED']
            early = [t for t in processed_data if t['DelayStatus'] == 'EARLY']
            canceled = [t for t in processed_data if t['IsCanceled']]
            replaced = [t for t in processed_data if t['IsReplaced']]
            
            print(f"Current status: {len(delays)} delayed, {len(early)} early, {len(canceled)} canceled, {len(replaced)} replaced")
        
    def start_monitoring(self, interval_minutes: int = 1):
        """Start continuous monitoring"""
        self.running = True
        print(f"Starting train delay monitoring for Gothenburg (interval: {interval_minutes} minutes)")
        
        def monitor_loop():
            while self.running:
                try:
                    self.update_data()
                    # Sleep for the full interval
                    time.sleep(interval_minutes * 60)
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    print(f"Error in monitoring loop: {e}")
                    # Wait 1 minute before retrying if there's an error
                    time.sleep(60)
        
        monitor_thread = threading.Thread(target=monitor_loop)
        monitor_thread.daemon = True
        monitor_thread.start()
        
        return monitor_thread
    
    def stop_monitoring(self):
        """Stop continuous monitoring"""
        self.running = False
        print("Stopping train delay monitoring")
    
    def get_current_delays(self) -> pd.DataFrame:
        """Get current delay data as DataFrame"""
        if os.path.exists(self.data_file):
            return pd.read_csv(self.data_file)
        return pd.DataFrame()
    
    def get_delay_summary(self) -> Dict:
        """Get summary of current delays"""
        df = self.get_current_delays()
        if df.empty:
            return {}
        
        summary = {
            'total_trains': len(df),
            'delayed_trains': len(df[df['DelayStatus'] == 'DELAYED']),
            'early_trains': len(df[df['DelayStatus'] == 'EARLY']),
            'canceled_trains': len(df[df['IsCanceled'] == True]),
            'replaced_trains': len(df[df['IsReplaced'] == True]),
            'average_delay': df[df['DelayMinutes'].notna()]['DelayMinutes'].mean(),
            'max_delay': df[df['DelayMinutes'].notna()]['DelayMinutes'].max(),
            'last_updated': df['LastUpdated'].iloc[0] if len(df) > 0 else None
        }
        
        return summary


# Example usage and testing functions
def main():
    """Main function for testing the train delay monitor"""
    monitor = TrainDelayMonitor()
    
    # Perform one update
    monitor.update_data()
    
    # Get and display summary
    summary = monitor.get_delay_summary()
    print("\nCurrent Delay Summary:")
    for key, value in summary.items():
        print(f"{key}: {value}")
    
    # Display current data
    current_data = monitor.get_current_delays()
    if not current_data.empty:
        print(f"\nCurrent train data ({len(current_data)} trains):")
        print(current_data[['AdvertisedTrainIdent', 'AdvertisedTimeAtLocation', 'DelayMinutes', 'DelayStatus', 'FromLocation']].to_string())

if __name__ == "__main__":
    main() 