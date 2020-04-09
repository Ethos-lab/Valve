#!/bin/bash
SRC=/Users/pubalidatta/go/src/github.com/openfaas/mitmproxy-master/
ROOT=/Users/pubalidatta/go/src/github.com/openfaas/
DEST=`pwd`

cd $SRC
cp -r README.rst MANIFEST.in dev.ps1 dev.sh mitmproxy pathod release requirements.txt setup.cfg setup.py tox.ini web $DEST

cp "$ROOT/tracefile.pl" $DEST
