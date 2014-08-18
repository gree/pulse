#!/usr/bin/perl

use strict;
use POSIX qw/strftime/;

chomp(my $health_str = `curl -s -S --write-out :%{http_code} 127.0.0.1:9000/healthCheck` );
my $response = $health_str;
if ($health_str =~ /(.*):200/) {
   
} else {

   my $restart = &restart_node($response);

};

sub restart_node {

   my $health_str = shift;

   chomp(my $date = strftime('%Y-%m-%d_%H:%M',localtime));

   my $log = "/mnt/log/node-watch-errors-$date.log";
   open (FILE, ">>$log");

   print FILE "Restarting healthDashboard service, $health_str " . $date . "\n";

   print "restarting node\n";
   my $restart_node = `cd /var/opt/monitor/healthDashboard && ./scripts/runHealthDashboard.sh restart`;
}

1;

