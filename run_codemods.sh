#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if at least one file is provided
if [ $# -eq 0 ]; then
  echo "Usage: $0 <file1> <file2> ... <fileN>"
  exit 1
fi

# Array of jscodemod scripts (from 1*.js to 7*.js), assuming they are located in the same directory as this script
scripts=("$SCRIPT_DIR"/1*.js "$SCRIPT_DIR"/2*.js "$SCRIPT_DIR"/3*.js "$SCRIPT_DIR"/4*.js "$SCRIPT_DIR"/5*.js "$SCRIPT_DIR"/6*.js "$SCRIPT_DIR"/7*.js)

# Loop over each jscodemod script
for script in "${scripts[@]}"; do
  # Ensure the script exists before running
  if [ -f "$script" ]; then
    echo "Running $script on provided files..."
    
    # Loop over all the provided files and run the current script on each file
    for file in "$@"; do
      if [ -f "$file" ]; then
        echo "Processing file: $file"
        npx jscodeshift --parser=tsx -t "$script" "$file"
      else
        echo "File $file does not exist. Skipping."
      fi
    done
  else
    echo "Script $script not found. Skipping."
  fi
done

echo "All scripts have been run on the provided files."
