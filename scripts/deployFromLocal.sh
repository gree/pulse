#!/bin/sh

PATH=$1

SERVER="50.17.166.123"

scp -r $PATH  $SERVER:/tmp/

ssh -t $SERVER 'sudo sh  /var/opt/monitor/healthDashboard/scripts/runHealthDashboard.sh stop
  sudo rm -rf /var/opt/monitor/healthDashboard
  sudo mkdir -p /var/opt/monitor/;  
  sudo cp -r /tmp/healthDashboard /var/opt/monitor/ ; 
  cd /var/opt/monitor/healthDashboard/ ; 
  sudo -E npm install mysql;
  sudo -E npm install dateformat;
  sudo -E npm install express;
  sudo -E npm install jade;
  sudo -E npm install memcached;
  sudo -E npm install mailer;
  sudo -E npm install restler;
  sudo -E npm install sprintf;
  sudo -E npm install vertica;
 sudo sh /var/opt/monitor/healthDashboard/scripts/runHealthDashboard.sh start;  
 sudo  rm -rf /tmp/healthDashboard'
