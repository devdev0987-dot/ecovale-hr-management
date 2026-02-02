#!/bin/bash

echo "Testing Railway PostgreSQL Connection..."
echo "=========================================="
echo ""
echo "Host: centerbeam.proxy.rlwy.net"
echo "Port: 42937"
echo "Database: railway"
echo "User: postgres"
echo ""

export PGPASSWORD='nwFPMudPoNNgYODtCziyhtcLWVMihpBV'

psql -h centerbeam.proxy.rlwy.net -p 42937 -U postgres -d railway -c "SELECT 'Connection successful!' as status, current_database() as database, now() as time;"

echo ""
echo "If you see the query result above, the connection is working!"
