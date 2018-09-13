del bundle.js /q
del ugly\* /q

copy index.html ugly
copy sprites-min.png ugly
copy licenses.txt ugly

call npm run uglify

cd ugly
call "C:\Program Files\7-Zip\7zG.exe" a -t7z envisionator_1.0.0.7z -mx=9 *

pause
