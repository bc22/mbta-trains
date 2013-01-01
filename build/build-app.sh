#!/bin/bash

output="../js/app.js"
i="combined-app.js"
files="app-files"

if [ -e $i ]; then rm $i; fi

touch $i

while read p; do
  cat $p >> $i
done < $files

java -jar yuicompressor-2.4.2.jar $i -o $output

rm $i