#!/bin/sh
#mitmdump --listen-port 8082 --listen-host 127.0.0.1 --mode transparent --showhost --set block_global=false -w outfile &
#openssl req -nodes -x509 -newkey rsa:2048 -keyout private.key -out cert.crt -subj "/C=US/ST=/L=/O=mitm/OU=CS/CN=\*.com"
#cat private.key cert.crt > cert.pem
#cp cert.pem /usr/local/share/ca-certificates/
cp certs/mitmproxy-ca-cert.pem /usr/local/share/ca-certificates/
update-ca-certificates
#rm private.key