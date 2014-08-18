#! /bin/sh

RETVAL=0
prog="healthDashboard"
env=$2
groupname="health-monitor"

if [ -z "$env" ] ; then
    env="prod"
fi
start () {
        DATE=`date "+%Y-%m-%d"`
        echo -n $"Starting $prog: "
    if [ "`stat -c %U /usr/local/bin/node`" != "$USER" ]; then
        chown $USER /usr/local/bin/node
    fi
nohup /usr/local/bin/node /var/opt/monitor/healthDashboard/src/server/index.js -port 9000 -env ${env} -service_group $groupname -service_name $prog>> /mnt/log/node-$DATE.log 2>> /mnt/log/error-$DATE.log < /dev/null &
        touch /mnt/log/healthdashboard.pid
        ps -ef | grep /var/opt/monitor/healthDashboard/src/server/index.js | grep -v grep | grep ^${_id} | awk '{print $2}' > /mnt/log/healthdashboard.pid
        RETVAL=$?
        echo
        [ $RETVAL -eq 0 ]
}
stop () {
        echo -n $"Stopping $prog: "
        cat /mnt/log/healthdashboard.pid | while read line
        do
            kill -9 $line
        done
        RETVAL=$?
        echo
        if [ $RETVAL -eq 0 ] ; then
            rm -f /mnt/log/healthdashboard.pid
        fi
}

restart () {
        stop
        start
}

# See how we were called.
case "$1" in
  start)
        start
        ;;
  stop)
        stop
        ;;
  restart)
        restart
        ;;
  *)
        echo $"Usage: $0 {start|stop|restart}"
        exit 1
esac

exit $?
