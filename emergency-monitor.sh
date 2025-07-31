#!/bin/bash

# Emergency script to monitor and manage server load
# Run this script when experiencing abnormal request volumes

echo "🚨 Emergency Server Load Management Script"
echo "=========================================="

# Function to check server health
check_health() {
    echo "📊 Checking server health..."
    curl -s http://localhost:5001/api/v1/monitor/health | jq '.'
}

# Function to get detailed stats
get_stats() {
    echo "📈 Getting detailed request statistics..."
    curl -s http://localhost:5001/api/v1/monitor/stats | jq '.'
}

# Function to emergency disable rate limiting
emergency_disable() {
    echo "🚨 EMERGENCY: Disabling rate limiting..."
    curl -s -X POST http://localhost:5001/api/v1/monitor/emergency-disable | jq '.'
    echo "⚠️  Rate limiting has been disabled. Remember to re-enable it after resolving the issue!"
}

# Function to monitor real-time requests
monitor_realtime() {
    echo "👀 Monitoring requests in real-time (press Ctrl+C to stop)..."
    while true; do
        clear
        echo "🕐 $(date)"
        echo "===================="
        check_health
        echo ""
        sleep 5
    done
}

# Main menu
echo ""
echo "What would you like to do?"
echo "1) Check server health"
echo "2) Get detailed statistics"
echo "3) Emergency disable rate limiting"
echo "4) Monitor real-time"
echo "5) Exit"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        check_health
        ;;
    2)
        get_stats
        ;;
    3)
        emergency_disable
        ;;
    4)
        monitor_realtime
        ;;
    5)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac
