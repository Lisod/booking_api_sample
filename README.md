<!-- @format -->

# Lisod web framework

Server part: Sails 1.2.4 \
Client part: React 16.13.1

## Development setup

#### Prerequired

- docker: https://docs.docker.com/install/
  Windows xài docker toolbox : https://docs.docker.com/toolbox/toolbox_install_windows/
  Amazon linux: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/docker-basics.html

- docker-compose: https://docs.docker.com/compose/install/
- nodedock: https://nodedock.io

- docker-compose: https://docs.docker.com/compose/install/
- nodedock: https://nodedock.io

#### Install nodedock

Pull nodedock

```
git submodule update --init
```

Copy and setting the .env

```
cd nodedock
cp env-example .env
```

Then edit the .env

```
NODEDOCK_SERVICES=nginx mysql node workspace
MYSQL_VERSION=5.7
MYSQL_DATABASE=default
MYSQL_USER=default
MYSQL_PASSWORD=secret
MYSQL_PORT=3306
MYSQL_ROOT_PASSWORD=root
MYSQL_ENTRYPOINT_INITDB=./mysql/docker-entrypoint-initdb.d
```

```
APP_CODE_PATH_HOST=../backend
```

Run services

```
./nodedock/start.sh
```

#### Setting the server part

Setting up local development

```
cp backend/local_template.js backend/config/env/local.js
set "script" start: `sails_environment=local sails --port 9000 lift --alter`
`cd backend/config/env`
edit datastore to : `adapter: 'sails-mysql', url: 'mysql://default:secret@mysql:3306/default'`
```

If using nodedock:

```
cd nodedock
docker-compose up -d workspace
docker-compose exec workspace bash

npm  install
```

edit local.js for your local environment

#### Setting the client part

Admin page

```
cd admin
npm install
```

Web page

```
cd frontend
npm install
```