import Component from './component'
import Template from './template'
import Subscribe from '../utils/subscribe'
import Controller from './controller'
import Head from '../components/head'
import Storage from '../utils/storage'
import Lang from '../utils/lang'

let listener  = Subscribe()
let activites = []
let callback  = false
let fullout   = false
let content
let slides
let maxsave

function Activity(component){
    let slide = Template.get('activity')
    let body  = slide.find('.activity__body')

    this.stoped  = false
    this.started = false

    /**
     * Добовляет активити в список активитис
     */
    this.append = function(){
        slides.append(slide)
    }

    /**
     * Создает новую активность
     */
    this.create = function(){
        try{
            component.create(body)

            body.append(component.render())
        }
        catch(e){

        }
    }

    /**
     * Показывает загрузку
     * @param {boolean} status 
     */
    this.loader = function(status){
        slide.toggleClass('activity--load',status)

        if(!status){
            setTimeout(()=>{
                Controller.updateSelects()
            },10)
        }
    }

    /**
     * Создает повторно
     */
    this.restart = function(){
        this.append()

        this.stoped = false

        component.start()
    }

    /**
     * Стартуем активную активность
     */
    this.start = function(){
        this.started = true

        Controller.add('content',{
            invisible: true,
            toggle: ()=>{},
            left: ()=>{
                Controller.toggle('menu')
            },
            up: ()=>{
                Controller.toggle('head')
            },
            back: ()=>{
                Activity.backward()
            }
        })

        Controller.toggle('content')

        if(this.stoped) this.restart()
        else component.start()
    }


    /**
     * Пауза
     */
    this.pause = function(){
        this.started = false

        component.pause()
    }

    /**
     * Включаем активность если она активна
     */
    this.toggle = function(){
        if(this.started) this.start()
    }

    /**
     * Стоп
     */
    this.stop = function(){
        this.started = false

        if(this.stoped) return

        this.stoped = true

        component.stop()

        slide.detach()
    }

    /**
     * Рендер
     */
    this.render = function(){
        return slide
    }

    /**
     * Получить класс компонента
     */
    this.component = function(){
        return component
    }

    /**
     * Уничтожаем активность
     */
    this.destroy = function(){
        component.destroy()

        //после create работает долгий запрос и затем вызывается build, однако уже было вызвано destroy и возникают ошибки, поэтому заодно чистим функцию build и empty
        for(let f in component){
            if(typeof component[f] == 'function'){
                component[f] = function(){}
            }
        }

        slide.remove()
    }

    this.append()
}

/**
 * Запуск
 */
function init(){
    content   = Template.get('activitys')
    slides    = content.find('.activitys__slides')
    maxsave   = Storage.get('pages_save_total',5)

    empty()

    let wait = true

    setTimeout(()=>{
        wait = false
    },1500)

    window.addEventListener('popstate', () => {
        if(fullout || wait) return
    
        empty()
    
        listener.send('popstate',{count: activites.length})
    
        if(callback) callback()
        else{
            backward()
        }
    })
    
    Storage.listener.follow('change', (event)=>{
        if(event.name == 'pages_save_total') maxsave = Storage.get('pages_save_total',5)
    })
}

/**
 * Лимит активностей, уничтожать если больше maxsave
 */
function limit(){
    let curent = active()

    if(curent && curent.activity) curent.activity.pause()

    let tree_stop = activites.slice(-2)

    if(tree_stop.length > 1 && tree_stop[0].activity) tree_stop[0].activity.stop()

    let tree_destroy = activites.slice(-maxsave)

    if(tree_destroy.length > (maxsave - 1)){
        let first = tree_destroy[0]

        if(first.activity){
            first.activity.destroy()

            first.activity = null
        } 
    } 
}

/**
 * Добавить новую активность
 * @param {{component:string}} object 
 */
function push(object){
    limit()

    create(object)

    activites.push(object)

    start(object)
}

/**
 * Создать новую активность
 * @param {{component:string}} object 
 */
function create(object){
    let comp = Component.create(object)

    object.activity = new Activity(comp)

    comp.activity = object.activity

    Lampa.Listener.send('activity',{component: object.component, type: 'init', object})

    object.activity.create()

    Lampa.Listener.send('activity',{component: object.component, type: 'create', object})
}

/**
 * Вызов обратно пользователем
 */
function back(){
    window.history.back();
}

/**
 * Получить активную активность
 * @returns {object}
 */
function active(){
    return activites[activites.length - 1]
}

/**
 * Создат пустую историю
 */
function empty(){
    window.history.pushState(null, null, window.location.pathname)
}

/**
 * Получить все активности
 * @returns {[{component:string, activity:class}]}
 */
function all(){
    return activites
}

/**
 * Получить рендеры всех активностей
 * @returns {array}
 */
function renderLayers(){
    let result = []

    all().forEach(item=>{
        if(item.activity) result.push(item.activity.render())
    })

    return result
}

/**
 * Обработать событие назад
 */
function backward(){
    callback = false;

    listener.send('backward',{count: activites.length})

    if(activites.length == 1) return

    slides.find('>div').removeClass('activity--active')

    let curent = activites.pop()

    if(curent){
        setTimeout(function(){
            curent.activity.destroy()

            Lampa.Listener.send('activity',{component: curent.component, type: 'destroy', object: curent})
        },200)
    }

    let previous_tree = activites.slice(-maxsave)

    if(previous_tree.length > (maxsave - 1)){
        create(previous_tree[0])
    }

    previous_tree = activites.slice(-1)[0]
    
    if(previous_tree){
        if(previous_tree.activity){
            start(previous_tree)
            
            Lampa.Listener.send('activity',{component: previous_tree.component, type: 'archive', object: previous_tree})
        }
        else {
            create(previous_tree)

            start(previous_tree)
        }
    }
}

/**
 * Сохранить активность в память
 * @param {{component:string, activity:class}} object 
 */
function save(object){
    let saved = {}

    for(let i in object){
        if(i !== 'activity') saved[i] = object[i]
    }

    Storage.set('activity', saved)
}

/**
 * Получить данные активности
 * @param {{component:string, activity:class}} object 
 * @returns {{component:string}}
 */
function extractObject(object){
    let saved = {}

    for(let i in object){
        if(i !== 'activity') saved[i] = object[i]
    }

    return saved
}

/**
 * Активируем следующию активность 
 * @param {{component:string, activity:class}} object 
 */
function start(object){
    save(object)

    object.activity.start()

    slides.find('> div').removeClass('activity--active')

    object.activity.render().addClass('activity--active')

    Head.title(object.title)

    Lampa.Listener.send('activity',{component: object.component, type: 'start', object})
}

/**
 * С какой активности начать запуск лампы
 */
function last(){
    let active = Storage.get('activity','false')
    let start_from = Storage.field("start_page")

    if(window.start_deep_link){
        push(window.start_deep_link)
    }
    else if(active && start_from === "last"){
        if(active.page) active.page = 1

        push(active)
    }
    else{
        const [ action, type ] = start_from.split('@');

        if(action == 'favorite') {
            push({
                url: '',
                title: type == 'book' ? Lang.translate('title_book') : type == 'like' ? Lang.translate('title_like') : type == 'history' ? Lang.translate('title_history') : Lang.translate('title_wath'),
                component: 'favorite',
                type: type,
                page: 1
            })
        }
        else if(action == 'mytorrents') {
            push({
                url: '',
                title: Lang.translate('title_mytorrents'),
                component: 'mytorrents',
                page: 1
            })
        }
        else {
            push({
                url: '',
                title: Lang.translate('title_main') + ' - ' + Storage.field('source').toUpperCase(),
                component: 'main',
                source: Storage.field('source'),
                page: 1
            })
        }
    }
}

/**
 * Рендер
 * @returns {object}
 */
function render(){
    return content
}

/**
 * Подключить обратный вызов при изменени истории
 * @param {*} call 
 */
function call(call){
    callback = call
}

/**
 * Выход из лампы
 */
function out(){
    fullout = true

    back()

    for (let i = 0; i < window.history.length; i++) {
        back()
    }

    setTimeout(()=>{
        fullout = false

        empty()
    },100)
}

/**
 * Заменить активную активность
 * @param {object} replace 
 */
function replace(replace = {}){
    let object = extractObject(active())

    for(var i in replace){
        object[i] = replace[i]
    }

    active().activity.destroy()

    activites.pop()

    push(object)
}

export default {
    init,
    listener,
    push,
    back,
    render,
    backward,
    call,
    last,
    out,
    replace,
    active,
    all,
    extractObject,
    renderLayers
}