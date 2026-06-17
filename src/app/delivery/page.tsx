"use client"

import { useState } from "react"
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  CheckCircle2, 
  Circle,
  MoreVertical,
  Plus,
  Car,
  FileText,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"

const deliveries = [
  {
    id: "DEL-001",
    client: "Alexander Vogel",
    model: "BMW i4 M50",
    vin: "WBG123...982",
    date: "Hoy",
    time: "10:00",
    advisor: "Sarah Connor",
    status: "Preparación",
    progress: 75,
    checklist: [
      { item: "PDI Completado", done: true },
      { item: "Limpieza y Detallado", done: true },
      { item: "Alfombrillas instaladas", done: true },
      { item: "Matrículas colocadas", done: false },
      { item: "Cables de carga presentes", done: true },
    ]
  },
  {
    id: "DEL-002",
    client: "Maria Rossi",
    model: "BMW X5 xDrive50e",
    vin: "WBG123...104",
    date: "Hoy",
    time: "14:30",
    advisor: "Mark Weber",
    status: "Listo",
    progress: 100,
    checklist: [
      { item: "PDI Completado", done: true },
      { item: "Limpieza y Detallado", done: true },
      { item: "Alfombrillas instaladas", done: true },
      { item: "Matrículas colocadas", done: true },
      { item: "Cables de carga presentes", done: true },
    ]
  },
  {
    id: "DEL-003",
    client: "James Chen",
    model: "BMW M3 Touring",
    vin: "WBG123...772",
    date: "Mañana",
    time: "09:00",
    advisor: "Sarah Connor",
    status: "En Proceso",
    progress: 40,
    checklist: [
      { item: "PDI Completado", done: true },
      { item: "Limpieza y Detallado", done: false },
      { item: "Alfombrillas instaladas", done: false },
      { item: "Matrículas colocadas", done: false },
      { item: "Cables de carga presentes", done: true },
    ]
  }
]

export default function DeliveryManagement() {
  const [activeTab, setActiveTab] = useState("all")

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-secondary">Gestión de Entregas</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Planifica y monitoriza la entrega de vehículos a clientes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white">
            <CalendarIcon className="w-4 h-4 mr-2" /> Vista Mensual
          </Button>
          <Button className="bg-primary">
            <Plus className="w-4 h-4 mr-2" /> Programar Entrega
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="premium-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Entregas de Hoy</p>
                <p className="text-3xl font-bold mt-1 text-secondary">08</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                <Clock className="text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Pendientes de Prep.</p>
                <p className="text-3xl font-bold mt-1 text-accent">03</p>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <CheckCircle2 className="text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Completadas esta Semana</p>
                <p className="text-3xl font-bold mt-1 text-emerald-600">24</p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
                <User className="text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Delivery List */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between bg-white p-2 rounded-xl border shadow-sm">
            <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
              <div className="flex items-center justify-between px-2">
                <TabsList className="bg-slate-100">
                  <TabsTrigger value="all">Todas las Entregas</TabsTrigger>
                  <TabsTrigger value="today">Hoy</TabsTrigger>
                  <TabsTrigger value="upcoming">Próximas</TabsTrigger>
                </TabsList>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9 bg-slate-50 border-none h-9" placeholder="Buscar cliente..." />
                </div>
              </div>
            </Tabs>
          </div>

          <div className="space-y-4">
            {deliveries.map((delivery) => (
              <Card key={delivery.id} className="premium-card overflow-hidden group">
                <div className="flex flex-col md:flex-row">
                  <div className={`w-2 ${delivery.status === 'Listo' ? 'bg-emerald-500' : 'bg-primary'}`} />
                  <CardContent className="flex-1 p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                          <Car className="text-secondary" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-secondary">{delivery.client}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] font-mono">{delivery.vin}</Badge>
                            <span className="text-sm font-medium text-muted-foreground">{delivery.model}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-8 items-center">
                        <div className="text-center md:text-right">
                          <div className="flex items-center gap-1 text-sm font-bold text-secondary justify-center md:justify-end">
                            <CalendarIcon className="w-3.5 h-3.5" /> {delivery.date}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground justify-center md:justify-end mt-1">
                            <Clock className="w-3.5 h-3.5" /> {delivery.time}
                          </div>
                        </div>

                        <div className="hidden sm:block min-w-[120px]">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Comercial</p>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-[10px] flex items-center justify-center font-bold text-blue-700">
                              {delivery.advisor.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span className="text-xs font-medium">{delivery.advisor}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem className="gap-2"><FileText className="w-4 h-4" /> Ver Checklist</DropdownMenuItem>
                              <DropdownMenuItem className="gap-2"><CheckCircle2 className="w-4 h-4" /> Marcar como Listo</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600 gap-2">Reprogramar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Progreso de Preparación</span>
                        <span className="text-[10px] font-bold text-primary">{delivery.progress}%</span>
                      </div>
                      <Progress value={delivery.progress} className="h-1.5" />
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Sidebar: Quick Checklist */}
        <div className="space-y-6">
          <Card className="premium-card h-fit sticky top-8">
            <CardHeader className="border-b bg-slate-50/50">
              <CardTitle className="text-base font-bold">Checklist Activa</CardTitle>
              <CardDescription className="text-xs">Seleccionado: {deliveries[0].client}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {deliveries[0].checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      {item.done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300" />
                      )}
                      <span className={`text-sm ${item.done ? 'text-slate-500 line-through' : 'font-medium text-secondary'}`}>
                        {item.item}
                      </span>
                    </div>
                    {!item.done && (
                      <Button variant="ghost" size="sm" className="h-8 text-[10px] uppercase font-bold text-primary hover:bg-blue-50">
                        Marcar Hecho
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-6 bg-slate-50 border-t">
                <Button className="w-full bg-secondary">
                  Completar Archivo de Entrega
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="premium-card bg-primary text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-16 -translate-y-16" />
            <CardHeader>
              <CardTitle className="text-base text-white">Objetivos Comerciales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Sarah Connor</span>
                  <span>14/20</span>
                </div>
                <Progress value={70} className="h-1 bg-white/20" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Mark Weber</span>
                  <span>08/15</span>
                </div>
                <Progress value={53} className="h-1 bg-white/20" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}