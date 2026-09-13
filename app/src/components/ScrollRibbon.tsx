import { useEffect, useRef } from 'react'

type Vertex = {x:number; y:number; z:number; twist:number; card?:number}
const clamp=(n:number)=>Math.max(0,Math.min(1,n))
// Лента — поверхность из граней с поворотом сечения и двумя слоями глубины.
// Координаты привязаны к реальным обложкам, а не к длине страницы.
export function ScrollRibbon({active}:{active:boolean}) {
  const canvas=useRef<HTMLCanvasElement>(null)
  useEffect(()=>{
    const el=canvas.current, ctx=el?.getContext('2d')
    if(!el || !ctx || !active) return
    const reduced=matchMedia('(prefers-reduced-motion: reduce)')
    let frame=0, disposed=false, width=0, height=0, settleUntil=0
    const draw=()=>{
      frame=0
      const w=document.documentElement.clientWidth, h=innerHeight
      if(width!==w || height!==h) {
        width=w;height=h;const dpr=Math.min(devicePixelRatio||1,2)
        el.width=w*dpr;el.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)
      }
      ctx.clearRect(0,0,w,h)
      if(reduced.matches) return
      const work=document.getElementById('work')?.getBoundingClientRect()
      if(!work || work.top>h || work.bottom<0) return
      const cards=[...document.querySelectorAll('.exhibit .project-art')].map(e=>e.getBoundingClientRect()).sort((a,b)=>a.top-b.top)
      const title=document.querySelector('.exhibition-head h2')?.getBoundingClientRect()
      const strokes=(vertices:Vertex[],head:number,tail:number,halfWidth:number)=>{
        const lo=Math.max(0,Math.floor(head-tail)),hi=Math.min(vertices.length-1,Math.ceil(head))
        if(hi<=lo)return
        const visible=vertices.slice(lo,hi+1)
        const gradient=ctx.createLinearGradient(Math.min(...visible.map(p=>p.x)),Math.min(...visible.map(p=>p.y)),Math.max(...visible.map(p=>p.x))+1,Math.max(...visible.map(p=>p.y))+1)
        gradient.addColorStop(0,'#526a4c');gradient.addColorStop(.34,'#a2af88');gradient.addColorStop(.62,'#435b40');gradient.addColorStop(1,'#7c9068')
        // Одна геометрия и одно освещение для всей ткани. Глубина
        // управляет перекрытием, но никогда не сжимает её ширину.
        const edges=vertices.map((p,n)=>{
          const a=vertices[Math.max(0,n-1)],b=vertices[Math.min(vertices.length-1,n+1)]
          const len=Math.hypot(b.x-a.x,b.y-a.y)||1
          const t=clamp(Math.min((n-(head-tail))/18,(head-n)/12))
          const breadth=halfWidth*(.72+.28*Math.cos(p.twist)**2)*t*t*(3-2*t)
          return {x:p.x,y:p.y,dx:-(b.y-a.y)/len*breadth,dy:(b.x-a.x)/len*breadth}
        })
        const paint=(begin:number,end:number,erase=false)=>{
          if(end<=begin)return
          const part=edges.slice(begin,end+1)
          ctx.beginPath()
          part.forEach((p,n)=>n?ctx.lineTo(p.x+p.dx,p.y+p.dy):ctx.moveTo(p.x+p.dx,p.y+p.dy))
          for(let n=part.length-1;n>=0;n--){const p=part[n];ctx.lineTo(p.x-p.dx,p.y-p.dy)}
          ctx.closePath();ctx.fillStyle=erase?'#000':gradient;ctx.fill()
          if(erase)return
          ctx.beginPath();part.forEach((p,n)=>n?ctx.lineTo(p.x+p.dx*.7,p.y+p.dy*.7):ctx.moveTo(p.x+p.dx*.7,p.y+p.dy*.7))
          ctx.strokeStyle='#e5e6c640';ctx.lineWidth=.8;ctx.stroke()
        }
        paint(lo,hi)
        // Каждый виток скрывается только за СВОЕЙ карточкой. Прежде
        // чужая соседняя карточка отрезала его по поперечному сечению.
        cards.forEach((r,card)=>{
          ctx.save();ctx.beginPath()
          const radius=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--preview-radius'))||0
          ctx.roundRect(r.left,r.top,r.width,r.height,radius);ctx.clip()
          for(const front of [false,true]) {
            ctx.globalCompositeOperation=front?'source-over':'destination-out'
            const belongs=(p:Vertex)=>front ? p.card===undefined || (p.card===card && p.z>=0) : p.card===card && p.z<0
            let i=lo
            while(i<hi){
              if(!belongs(vertices[i])){i++;continue}
              const begin=i
              while(i<hi && belongs(vertices[i+1]))i++
              // Соседняя точка включает смену глубины; оба конца
              // находятся за боковыми краями собственной карточки.
              paint(Math.max(lo,begin-1),Math.min(hi,i+1),!front);i++
            }
          }
          ctx.restore()
        })
      }
      const connect=(out:Vertex[],a:Vertex,b:Vertex,bend:number,direction:'down'|'up'|'right'='down')=>{
        const prev=out[out.length-2]??{x:a.x-1,y:a.y}
        const len=Math.hypot(a.x-prev.x,a.y-prev.y)||1,k=Math.abs(bend)
        const c1={x:a.x+(a.x-prev.x)/len*k,y:a.y+(a.y-prev.y)/len*k}
        const c2={x:b.x-(direction==='right'?k:0),y:b.y+(direction==='up'?k:direction==='down'?-k:0)}
        for(let i=1;i<=48;i++) {const t=i/48,s=1-t;out.push({x:s*s*s*a.x+3*s*s*t*c1.x+3*s*t*t*c2.x+t*t*t*b.x,y:s*s*s*a.y+3*s*s*t*c1.y+3*s*t*t*c2.y+t*t*t*b.y,z:a.z*s+b.z*t-.8*Math.sin(Math.PI*t),twist:a.twist+(b.twist-a.twist)*t})}
      }
      // Короткая самостоятельная сцена у заголовка: слева → виток → вправо.
      if(title && title.bottom>-100 && title.top<h) {
        const cx=title.left+title.width/2,cy=title.top+title.height/2
        const rx=title.width*.56+20,ry=title.height*.8+22
        const v:Vertex[]=[{x:-120,y:cy-45,z:-1,twist:0}]
        connect(v,v[0],{x:cx-rx,y:cy,z:0,twist:.3},75,'up')
        for(let i=1;i<=120;i++){const t=i/120,a=Math.PI+t*Math.PI*2;v.push({x:cx+rx*Math.cos(a),y:cy+ry*Math.sin(a),z:Math.sin(a),twist:t*Math.PI*2+.3})}
        connect(v,v[v.length-1],{x:w+150,y:cy+80,z:-1,twist:8},160,'right')
        const p=clamp((h*.85-title.top)/(h*.7))
        strokes(v,p*(v.length+85),85,w<680?13:22)
      }
      if(!cards.length)return
      // Один маршрут связывает все обложки; по нему скользит конечный отрезок ткани.
      const v:Vertex[]=[{x:w+160,y:cards[0].top-70,z:-1,twist:0}]
      const anchors=[{y:cards[0].top-h*.2,index:0}]
      cards.forEach((r,index)=>{
        const cx=r.left+r.width/2,cy=r.top+r.height*.45,rx=r.width*.55+12,ry=r.height*.35
        const first={x:cx+rx,y:cy,z:0,twist:index*2}
        connect(v,v[v.length-1],first,85)
        // Reuse the connector endpoint. Duplicate points give two different
        // normals at the same centre and leave a visible notch at the join.
        const orbitStart=v.length-1
        v[orbitStart].card=index
        for(let i=1;i<=140;i++) {
          const t=i/140,a=t*Math.PI*2
          v.push({x:cx+rx*Math.cos(a),y:cy+ry*Math.sin(a)+t*Math.min(28,r.height*.05),z:Math.sin(a),twist:index*2+t*Math.PI*2.5,card:index})
        }
        anchors.push({y:Math.max(anchors[anchors.length-1].y+1,cy),index:orbitStart+70})
      })
      connect(v,v[v.length-1],{x:w+180,y:cards[cards.length-1].bottom+80,z:-1,twist:15},150,'right')
      anchors.push({y:Math.max(anchors[anchors.length-1].y+1,cards[cards.length-1].bottom+h*.15),index:v.length+155})
      let head=0
      for(let i=1;i<anchors.length;i++) {
        const a=anchors[i-1],b=anchors[i]
        if(h*.6>=a.y)head=a.index+(b.index-a.index)*clamp((h*.6-a.y)/(b.y-a.y))
      }
      strokes(v,head,155,w<680?14:25)
    }
    // Scroll timelines can composite a frame after the scroll event. Follow
    // their final position too, so the canvas never keeps a stale card mask.
    const tick=()=>{draw();if(!disposed&&performance.now()<settleUntil)frame=requestAnimationFrame(tick)}
    const request=()=>{settleUntil=performance.now()+240;if(!disposed&&!frame)frame=requestAnimationFrame(tick)}
    const observer=new ResizeObserver(request)
    const home=document.querySelector('.portfolio-home');if(home)observer.observe(home)
    window.addEventListener('scroll',request,{passive:true});window.addEventListener('resize',request)
    reduced.addEventListener('change',request);document.fonts.ready.then(request);request()
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('scroll',request);window.removeEventListener('resize',request);reduced.removeEventListener('change',request)}
  },[active])
  return <canvas ref={canvas} className="page-ribbon" aria-hidden="true" style={{display:active?undefined:'none'}} />
}
