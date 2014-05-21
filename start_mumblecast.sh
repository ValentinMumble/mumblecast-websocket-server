#!/bin/bash
rm -f /home/mumblecast/server.log
sudo -Hu www-data git pull
/etc/init.d/mysql start
/home/mumblecast/node_modules/forever/bin/forever start -l /home/mumblecast/server.log /home/mumblecast/server.js
