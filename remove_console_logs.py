#!/usr/bin/env python3
import os
import re
import sys

def remove_console_logs(file_path):
    """Remove console.log, console.debug, and console.info statements from a file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Pattern to match console.log, console.debug, console.info statements
        # This handles both single line and multiline statements
        console_pattern = r'console\.(log|debug|info)\s*\([^;]*?\);?'
        
        # For multiline console statements, we need a more comprehensive approach
        lines = content.split('\n')
        new_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Check if this line starts a console.log/debug/info statement
            if re.search(r'\s*console\.(log|debug|info)\s*\(', line):
                # Find the end of this console statement
                paren_count = line.count('(') - line.count(')')
                j = i
                
                # Keep reading lines until we find the closing parenthesis
                while paren_count > 0 and j < len(lines) - 1:
                    j += 1
                    if j < len(lines):
                        paren_count += lines[j].count('(') - lines[j].count(')')
                
                # Skip all lines from i to j (inclusive)
                i = j + 1
                continue
            else:
                new_lines.append(line)
                i += 1
        
        new_content = '\n'.join(new_lines)
        
        # Write back only if content changed
        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"✅ Cleaned: {file_path}")
            return True
        else:
            return False
            
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False

def main():
    base_dir = "/Users/dr.hunter/CS Projects/at-Cloud-sign-up-system"
    
    # Find all TypeScript files
    directories = [
        os.path.join(base_dir, "frontend", "src"),
        os.path.join(base_dir, "backend", "src")
    ]
    
    files_cleaned = 0
    
    for directory in directories:
        if os.path.exists(directory):
            for root, dirs, files in os.walk(directory):
                for file in files:
                    if file.endswith(('.ts', '.tsx')):
                        file_path = os.path.join(root, file)
                        if remove_console_logs(file_path):
                            files_cleaned += 1
    
    print(f"\n🎉 Cleaning complete! {files_cleaned} files were cleaned.")

if __name__ == "__main__":
    main()
