#!/bin/bash

echo "Testing Railway MySQL Connection..."
echo "===================================="
echo ""
echo "Host: caboose.proxy.rlwy.net"
echo "Port: 31780"
echo "Database: railway"
echo "User: root"
echo ""

# Create a temporary MySQL config file
cat > /tmp/my.cnf << EOF
[client]
host=caboose.proxy.rlwy.net
port=31780
user=root
password=MFCPqQfEUjybWfKBDyEOqJjycpJUiViW
database=railway
EOF

# Test connection
mysql --defaults-extra-file=/tmp/my.cnf -e "SELECT 'Connection successful!' as status, DATABASE() as database, NOW() as time;"

# Cleanup
rm /tmp/my.cnf

echo ""
echo "If you see the query result above, the connection is working!"
