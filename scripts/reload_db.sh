#!/bin/sh

date

echo "Dropping..."
echo "DROP DATABASE IF EXISTS health_aggregator;" | $MYSQL -u $MYSQL_USER

echo "Creating..."
echo "CREATE DATABASE health_aggregator;" | $MYSQL -u $MYSQL_USER



echo "Hard database reload complete."
date
