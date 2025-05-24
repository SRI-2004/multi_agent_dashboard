#!/bin/bash
export NEXT_PUBLIC_POSTHOG_KEY=""
export NEXT_PUBLIC_POSTHOG_HOST=""

# This script runs when the sandbox template instance starts.
# Its main job is to start the Next.js server.

function ping_server() {
	counter=0
	# Using double quotes for curl arguments as in fragments example
	response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000")
	while [[ ${response} -ne 200 ]]; do 
	  let counter++
	  if (( counter % 20 == 0 )); then 
        echo "Waiting for server to start..." # Standard double quotes
        sleep 0.1
      fi
	  response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000")
	done
  echo "Server check completed. Response: ${response}" # Standard double quotes
}

# Run ping_server in the background to monitor/log
ping_server & 

# Ensure we are in the correct directory and start Next.js
cd /home/user && echo "Starting Next.js development server (npx next --turbo)..." && npx next --turbo