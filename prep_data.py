import json,math,base64,collections
import numpy as np
from scipy import ndimage
from matplotlib.path import Path
D='/mnt/user-data/uploads/orly-3d-passation/visualiser/public/'
M=json.load(open(D+'orly_meshes.json')); P=json.load(open(D+'orly_pois.json')); LF=json.load(open(D+'orly_lifts.json'))
LON0,LAT0=2.3660,48.7285
MX=111320*math.cos(math.radians(LAT0)); MY=110574
def pr(lon,lat): return ((lon-LON0)*MX,(lat-LAT0)*MY)
LEVELS=[-1,0,1,2]
RES=1.5
xs=[];ys=[]
for m in M:
  if m['level'] in LEVELS and m['layer']!='buildings':
    for part in m['footprints']:
      for lo,la in part['outer']:
        x,y=pr(lo,la); xs.append(x); ys.append(y)
minx,maxx,miny,maxy=min(xs)-10,max(xs)+10,min(ys)-10,max(ys)+10
W=int((maxx-minx)/RES)+1; H=int((maxy-miny)/RES)+1
print('grid',W,H)
gx,gy=np.meshgrid(minx+(np.arange(W)+.5)*RES, miny+(np.arange(H)+.5)*RES)
pts=np.c_[gx.ravel(),gy.ravel()]
out={'res':RES,'minx':minx,'miny':miny,'W':W,'H':H,'levels':{}}
def simp(ring):
  r=[pr(*p) for p in ring]; o=[r[0]]
  for p in r[1:]:
    if math.hypot(p[0]-o[-1][0],p[1]-o[-1][1])>0.8: o.append(p)
  return [[round(a,1),round(b,1)] for a,b in o]
for lv in LEVELS:
  walk=np.zeros(W*H,bool); wall=np.zeros(W*H,bool)
  zones=[];walls=[]
  for m in M:
    if m['level']!=lv: continue
    for part in m['footprints']:
      ring=simp(part['outer'])
      if len(ring)<3: continue
      path=Path(np.array(ring))
      bb=path.get_extents()
      sel=(pts[:,0]>=bb.x0)&(pts[:,0]<=bb.x1)&(pts[:,1]>=bb.y0)&(pts[:,1]<=bb.y1)
      idx=np.where(sel)[0]
      if len(idx):
        inside=path.contains_points(pts[idx])
        holes=[Path(np.array(simp(h))) for h in part.get('holes',[]) if len(h)>=3]
        for hp in holes: inside&=~hp.contains_points(pts[idx])
        if m['layer']=='zonePOI': walk[idx[inside]]=True
        elif m['layer']=='structurePOI': wall[idx[inside]]=True
      (zones if m['layer']=='zonePOI' else walls if m['layer']=='structurePOI' else []).append(ring)
  g=(walk&~wall).reshape(H,W)
  lab,n=ndimage.label(g,structure=np.ones((3,3)))
  sz=np.bincount(lab.ravel()); keep=np.where(sz>1500)[0]; keep=keep[keep>0]
  g=np.isin(lab,keep).ravel()
  out['levels'][lv]={'grid':base64.b64encode(np.packbits(g).tobytes()).decode(),'zones':zones,'walls':walls}
  print(lv,'walk cells',g.sum(),'zones',len(zones),'walls',len(walls))
# POIs
pois=[]
for p in P:
  if p['level'] not in LEVELS: continue
  c=p.get('category')
  if p['level']==1 and p['icon']=='241.png': c='gate'
  if c not in ('security','restaurant','toilet','info','gate','transport','lift'): continue
  if c=='security' and p['icon']!='210.png': continue
  x,y=pr(p['lon'],p['lat'])
  pois.append({'c':c,'l':p['level'],'x':round(x,1),'y':round(y,1),'i':p['icon']})
# dedupe within 6m same cat/level
ded=[]
for p in pois:
  if any(q['c']==p['c'] and q['l']==p['l'] and math.hypot(q['x']-p['x'],q['y']-p['y'])<(10 if p['c']=='gate' else 6) for q in ded): continue
  ded.append(p)
print(collections.Counter((p['c'],p['l']) for p in ded))
lifts=[]
for l in LF:
  if len(l['serves'])<2: continue
  x,y=pr(l['lon'],l['lat'])
  key=(l['shaft'])
  lifts.append({'s':l['shaft'],'l':l['level'],'x':round(x,1),'y':round(y,1),'serves':l['serves']})
out['pois']=ded; out['lifts']=lifts
out['proj']={'lon0':LON0,'lat0':LAT0,'mx':MX,'my':MY}
json.dump(out,open('data.json','w'),separators=(',',':'))
import os;print(os.path.getsize('data.json')/1e6,'MB')
