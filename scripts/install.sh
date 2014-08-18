#!/bin/sh
DIR=/var/opt/monitor

# Make sure that monitor exists in /var/opt/
if [! -d "$DIR" ]; then
	echo "$DIR directory not found!"
	exit;
fi

cd /var/opt/monitor/healthDashboard/ ;
yum install -y openssl
yum install -y openssl-devel
git clone --depth 1 git://github.com/joyent/node.git
cd node
git pull
git checkout v0.6.3 # optional.  Note that master is unstable.
./configure
make -j2
make install
cd ../
rm -r node

curl http://npmjs.org/install.sh | sh
sudo -E npm install mysql;
sudo -E npm install dateformat;
sudo -E npm install express;
sudo -E npm install jade;
sudo -E npm install memcached;
sudo -E npm install mailer;
sudo -E npm install restler;
sudo -E npm install sprintf;
sudo -E npm install vertica;
