@echo off

echo Creating cert folder...
if not exist cert (
mkdir cert
)

cd cert

echo.

REM Generate private key if not exists
if exist private.pem (
echo private.pem already exists. Skipping...
) else (
echo Generating private key...
openssl genrsa -out private.pem 2048
)

echo.

REM Generate public key if not exists
if exist public.pem (
echo public.pem already exists. Skipping...
) else (
echo Generating public key...
openssl rsa -in private.pem -pubout -out public.pem
)

echo.
echo Done!
echo Keys location: %cd%
pause
