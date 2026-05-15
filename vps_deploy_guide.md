#How to sync infra folder to vps

1. Run command below

```
scp -r ./infra/ root@188.166.241.110:/root/crm/
```

#How to connect mongodb in vps

1. Run command: ssh -L 27038:127.0.0.1:27017 root@188.166.241.110
2. Enter password: xxx
3. Connect in mongo compass

#How to sync backend to vps and run

1. Run command below

```
rsync -avz \
  --exclude node_modules \
  --exclude docs \
  --exclude .continue \
  --exclude tests \
  --exclude .git \
  --exclude .env \
  --exclude vps_deploy_guide.md \
  ./crm-server/ root@188.166.241.110:/root/crm/crm-server/
```

2. Run command below

```
pm2 start npm --name crm-server -- run prod
```
