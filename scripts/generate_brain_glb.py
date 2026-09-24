#!/usr/bin/env python3
import os,sys,math,numpy as np,trimesh
from trimesh.visual.material import PBRMaterial
OUT=sys.argv[1] if len(sys.argv)>1 else "public/assets/AgentiCuantico_brain_PBR.glb";np.random.seed(42)
def hemi(side):
 m=trimesh.creation.icosphere(subdivisions=4,radius=1.0);v=m.vertices.copy();v[:,0]*=1.18;v[:,1]*=1.34;v[:,2]*=.92;r=np.linalg.norm(v,axis=1);t=np.arctan2(v[:,2],v[:,0]);p=np.arcsin(np.clip(v[:,1]/np.maximum(r,1e-8),-1,1));d=.055*np.sin(7*t+2.5*p)+.035*np.sin(13*t-4*p)+.022*np.sin(21*t+6*p)+.018*np.sin(5*t+11*p);w=.65+.35*np.abs(v[:,0])/np.max(np.abs(v[:,0]));v*=1+d[:,None]*w[:,None];v[:,0]=side*(.64+np.abs(v[:,0])*.93);v[:,2]*=1.03;v[:,1]+=.025*np.sin(t*3);m.vertices=v;return m
L,R=hemi(-1),hemi(1);S=trimesh.creation.cylinder(radius=.22,height=1.05,sections=32);S.apply_translation([0,-1.15,.08]);S.apply_transform(trimesh.transformations.rotation_matrix(math.radians(-6),[1,0,0]));B=trimesh.creation.icosphere(subdivisions=3,radius=.3);B.apply_scale([.9,1.15,.9]);B.apply_translation([0,-.72,.04]);C=trimesh.creation.icosphere(subdivisions=3,radius=.18);C.apply_translation([0,-.02,.42])
A=PBRMaterial(baseColorFactor=[.025,.16,.32,1],metallicFactor=.72,roughnessFactor=.28,emissiveFactor=[.02,.34,.95]);V=PBRMaterial(baseColorFactor=[.08,.03,.26,1],metallicFactor=.5,roughnessFactor=.32,emissiveFactor=[.18,.03,.75])
for m in(L,S,B):m.visual.material=A
for m in(R,C):m.visual.material=V
sc=trimesh.Scene()
for m,n in((L,"Brain_Left"),(R,"Brain_Right"),(S,"Brain_Stem"),(B,"Brain_Bulb"),(C,"Neural_Core")):sc.add_geometry(m,node_name=n,geom_name=n)
os.makedirs(os.path.dirname(OUT),exist_ok=True);sc.export(OUT);print(OUT)
