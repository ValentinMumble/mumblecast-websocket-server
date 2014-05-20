#!/bin/bash
sudo -Hu www-data git pull
/etc/init.d/mysql start
/home/mumblecast/node_modules/forever/bin/forever start /home/mumblecast/server.js
#../node-v0.10.28/node server.js
