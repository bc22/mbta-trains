#!/bin/bash

output="../css/min.css"
i="combined-css.css"
files="css-files"

if [ -e $i ]; then rm $i; fi

touch $i

while read p; do
  cat $p >> $i
done < $files

java -jar yuicompressor-2.4.2.jar $i -o $output

rm $i